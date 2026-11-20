import { prisma } from "@/lib/database";
import { RosterStatus } from "@prisma/client";
import {
  CreateRosterEntryInput,
  UpdateRosterEntryInput,
  BulkShiftAssignInput,
  CopyWeekRosterInput,
  CopyPersonShiftInput,
} from "@/domain/roster/types";
import { calculateShiftInterval, getWeekDates } from "@/lib/dates";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { AuditService } from "./auditService";
import { SessionUser } from "../auth/session";
import { AuthorizationService } from "../authorization/service";
import { SyncService } from "./syncService";

export class RosterService {
  /**
   * Asserts that the person has an ACTIVE membership in the support group.
   */
  private static async assertActiveMembership(
    personId: string,
    supportGroupId: string
  ): Promise<void> {
    const person = await prisma.person.findUnique({
      where: { id: personId },
    });
    if (!person || !person.active) {
      throw new ValidationError(
        "Cannot assign roster shifts to an inactive or non-existent person"
      );
    }

    const membership = await prisma.personSupportGroup.findUnique({
      where: {
        personId_supportGroupId: {
          personId,
          supportGroupId,
        },
      },
    });

    if (!membership || !membership.active) {
      throw new ValidationError(
        "Cannot create roster: Person does not have an active membership in this Support Group"
      );
    }
  }

  /**
   * Checks for duplicate and overlapping shifts for the person in the support group.
   */
  private static async assertNoConflicts(
    personId: string,
    supportGroupId: string,
    rosterDate: string,
    startTime: string,
    endTime: string,
    timeZone: string,
    rosterStatus: RosterStatus,
    excludeEntryId?: string
  ): Promise<void> {
    // 1. Check for exact duplicate
    const existing = await prisma.rosterEntry.findMany({
      where: {
        personId,
        supportGroupId,
        rosterDate,
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
    });

    for (const entry of existing) {
      if (
        entry.startTime === startTime &&
        entry.endTime === endTime &&
        entry.rosterStatus === rosterStatus
      ) {
        throw new ValidationError(
          `Duplicate shift already exists for this person on ${rosterDate} (${startTime}-${endTime})`
        );
      }
    }

    // 2. If this is a WORKING shift, check for overlapping WORKING shifts
    if (rosterStatus === RosterStatus.WORKING) {
      const { start: newStart, end: newEnd } = calculateShiftInterval(
        rosterDate,
        startTime,
        endTime,
        timeZone
      );

      // We need to inspect adjacent dates as well in case of overnight shifts!
      const adjacentDates = [
        rosterDate,
        // previous day (could overlap into today)
        new Date(new Date(rosterDate).getTime() - 86400000).toISOString().split("T")[0],
        // next day (today's overnight could overlap into tomorrow)
        new Date(new Date(rosterDate).getTime() + 86400000).toISOString().split("T")[0],
      ];

      const potentialOverlaps = await prisma.rosterEntry.findMany({
        where: {
          personId,
          supportGroupId,
          rosterStatus: RosterStatus.WORKING,
          rosterDate: { in: adjacentDates },
          ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
        },
      });

      for (const entry of potentialOverlaps) {
        const { start: existStart, end: existEnd } = calculateShiftInterval(
          entry.rosterDate,
          entry.startTime,
          entry.endTime,
          entry.timeZone
        );

        const overlaps =
          newStart.getTime() < existEnd.getTime() &&
          existStart.getTime() < newEnd.getTime();

        if (overlaps) {
          throw new ValidationError(
            `Overlapping shift detected: Scheduled shift (${startTime}-${endTime}) overlaps with existing shift (${entry.startTime}-${entry.endTime} on ${entry.rosterDate})`
          );
        }
      }
    }
  }

  /**
   * Creates a single roster entry.
   */
  public static async createEntry(
    input: CreateRosterEntryInput,
    user: SessionUser
  ) {
    AuthorizationService.assertCanManageSupportGroup(user, input.supportGroupId);
    await this.assertActiveMembership(input.personId, input.supportGroupId);
    await this.assertNoConflicts(
      input.personId,
      input.supportGroupId,
      input.rosterDate,
      input.startTime,
      input.endTime,
      input.timeZone,
      input.rosterStatus
    );

    const entry = await prisma.rosterEntry.create({
      data: {
        ...input,
        createdBy: user.loginName,
        updatedBy: user.loginName,
      },
      include: {
        person: true,
        supportGroup: true,
      },
    });

    await AuditService.log({
      entityType: "ROSTER_ENTRY",
      entityId: entry.id,
      action: "CREATE",
      newValue: entry,
      performedBy: user.loginName,
    });

    SyncService.triggerAutoSync(
      [{ personId: entry.personId, supportGroupId: entry.supportGroupId }],
      user.loginName
    );

    return entry;
  }

  /**
   * Updates a single roster entry.
   */
  public static async updateEntry(
    id: string,
    input: UpdateRosterEntryInput,
    user: SessionUser
  ) {
    const existing = await prisma.rosterEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Roster entry ${id} not found`);
    }

    AuthorizationService.assertCanManageSupportGroup(user, existing.supportGroupId);
    await this.assertActiveMembership(existing.personId, existing.supportGroupId);

    const updatedStartTime = input.startTime ?? existing.startTime;
    const updatedEndTime = input.endTime ?? existing.endTime;
    const updatedTimeZone = input.timeZone ?? existing.timeZone;
    const updatedStatus = input.rosterStatus ?? existing.rosterStatus;

    await this.assertNoConflicts(
      existing.personId,
      existing.supportGroupId,
      existing.rosterDate,
      updatedStartTime,
      updatedEndTime,
      updatedTimeZone,
      updatedStatus,
      id
    );

    const updated = await prisma.rosterEntry.update({
      where: { id },
      data: {
        startTime: updatedStartTime,
        endTime: updatedEndTime,
        timeZone: updatedTimeZone,
        rosterStatus: updatedStatus,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        updatedBy: user.loginName,
      },
    });

    await AuditService.log({
      entityType: "ROSTER_ENTRY",
      entityId: id,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
      performedBy: user.loginName,
    });

    SyncService.triggerAutoSync(
      [{ personId: updated.personId, supportGroupId: updated.supportGroupId }],
      user.loginName
    );

    return updated;
  }

  /**
   * Deletes a roster entry.
   */
  public static async deleteEntry(id: string, user: SessionUser) {
    const existing = await prisma.rosterEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Roster entry ${id} not found`);
    }

    AuthorizationService.assertCanManageSupportGroup(user, existing.supportGroupId);

    await prisma.rosterEntry.delete({
      where: { id },
    });

    await AuditService.log({
      entityType: "ROSTER_ENTRY",
      entityId: id,
      action: "DELETE",
      oldValue: existing,
      performedBy: user.loginName,
    });

    SyncService.triggerAutoSync(
      [{ personId: existing.personId, supportGroupId: existing.supportGroupId }],
      user.loginName
    );

    return { success: true };
  }

  /**
   * Retrieves roster entries for a support group within a date range.
   */
  public static async getRoster(
    supportGroupId: string,
    startDate: string,
    endDate: string
  ) {
    return prisma.rosterEntry.findMany({
      where: {
        supportGroupId,
        rosterDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        person: true,
      },
      orderBy: [{ rosterDate: "asc" }, { startTime: "asc" }],
    });
  }

  /**
   * Retrieves a person's individual roster.
   */
  public static async getPersonRoster(
    personId: string,
    startDate: string,
    endDate: string
  ) {
    return prisma.rosterEntry.findMany({
      where: {
        personId,
        rosterDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        supportGroup: true,
      },
      orderBy: [{ rosterDate: "asc" }, { startTime: "asc" }],
    });
  }

  /**
   * Bulk assigns shifts to multiple people across multiple dates.
   */
  public static async bulkAssign(
    input: BulkShiftAssignInput,
    user: SessionUser
  ) {
    AuthorizationService.assertCanManageSupportGroup(user, input.supportGroupId);

    const created: string[] = [];

    for (const personId of input.personIds) {
      await this.assertActiveMembership(personId, input.supportGroupId);

      for (const rosterDate of input.dates) {
        try {
          await this.assertNoConflicts(
            personId,
            input.supportGroupId,
            rosterDate,
            input.startTime,
            input.endTime,
            input.timeZone,
            input.rosterStatus
          );

          const entry = await prisma.rosterEntry.create({
            data: {
              personId,
              supportGroupId: input.supportGroupId,
              rosterDate,
              startTime: input.startTime,
              endTime: input.endTime,
              timeZone: input.timeZone,
              rosterStatus: input.rosterStatus,
              notes: input.notes,
              createdBy: user.loginName,
              updatedBy: user.loginName,
            },
          });
          created.push(entry.id);
        } catch {
          // If conflict occurs during bulk assignment on a specific slot, skip that specific slot
        }
      }
    }

    await AuditService.log({
      entityType: "ROSTER_ENTRY",
      entityId: input.supportGroupId,
      action: "BULK_ASSIGN",
      newValue: { count: created.length, createdIds: created },
      performedBy: user.loginName,
    });

    const bulkTargets = input.personIds.map((pId) => ({
      personId: pId,
      supportGroupId: input.supportGroupId,
    }));
    SyncService.triggerAutoSync(bulkTargets, user.loginName);

    return { createdCount: created.length, createdIds: created };
  }

  /**
   * Copies an entire previous week's roster to a target week.
   */
  public static async copyWeek(input: CopyWeekRosterInput, user: SessionUser) {
    AuthorizationService.assertCanManageSupportGroup(user, input.supportGroupId);

    const sourceDates = getWeekDates(input.sourceMonday);
    const targetDates = getWeekDates(input.targetMonday);

    const sourceEntries = await prisma.rosterEntry.findMany({
      where: {
        supportGroupId: input.supportGroupId,
        rosterDate: {
          gte: sourceDates[0],
          lte: sourceDates[6],
        },
      },
      include: {
        person: {
          include: {
            supportGroups: {
              where: { supportGroupId: input.supportGroupId },
            },
          },
        },
      },
    });

    let copiedCount = 0;

    for (const entry of sourceEntries) {
      // Check if person is still active in group
      const membership = entry.person.supportGroups[0];
      if (!entry.person.active || !membership || !membership.active) {
        continue;
      }

      const dayIndex = sourceDates.indexOf(entry.rosterDate);
      if (dayIndex === -1) continue;
      const targetDate = targetDates[dayIndex];

      try {
        await this.assertNoConflicts(
          entry.personId,
          input.supportGroupId,
          targetDate,
          entry.startTime,
          entry.endTime,
          entry.timeZone,
          entry.rosterStatus
        );

        await prisma.rosterEntry.create({
          data: {
            personId: entry.personId,
            supportGroupId: input.supportGroupId,
            rosterDate: targetDate,
            startTime: entry.startTime,
            endTime: entry.endTime,
            timeZone: entry.timeZone,
            rosterStatus: entry.rosterStatus,
            notes: entry.notes,
            createdBy: user.loginName,
            updatedBy: user.loginName,
          },
        });
        copiedCount++;
      } catch {
        // Skip conflicting slots
      }
    }

    await AuditService.log({
      entityType: "ROSTER_ENTRY",
      entityId: input.supportGroupId,
      action: "COPY_WEEK",
      newValue: {
        sourceMonday: input.sourceMonday,
        targetMonday: input.targetMonday,
        copiedCount,
      },
      performedBy: user.loginName,
    });

    const uniquePersonIds = Array.from(new Set(sourceEntries.map((e) => e.personId)));
    SyncService.triggerAutoSync(
      uniquePersonIds.map((pId) => ({
        personId: pId,
        supportGroupId: input.supportGroupId,
      })),
      user.loginName
    );

    return { copiedCount };
  }

  /**
   * Copies one person's shift on a source date to multiple target dates.
   */
  public static async copyPersonShift(
    input: CopyPersonShiftInput,
    user: SessionUser
  ) {
    AuthorizationService.assertCanManageSupportGroup(user, input.supportGroupId);
    await this.assertActiveMembership(input.personId, input.supportGroupId);

    const sourceEntry = await prisma.rosterEntry.findFirst({
      where: {
        personId: input.personId,
        supportGroupId: input.supportGroupId,
        rosterDate: input.sourceDate,
      },
    });

    if (!sourceEntry) {
      throw new NotFoundError(
        `No source shift found for person on ${input.sourceDate}`
      );
    }

    let copiedCount = 0;
    for (const targetDate of input.targetDates) {
      try {
        await this.assertNoConflicts(
          input.personId,
          input.supportGroupId,
          targetDate,
          sourceEntry.startTime,
          sourceEntry.endTime,
          sourceEntry.timeZone,
          sourceEntry.rosterStatus
        );

        await prisma.rosterEntry.create({
          data: {
            personId: input.personId,
            supportGroupId: input.supportGroupId,
            rosterDate: targetDate,
            startTime: sourceEntry.startTime,
            endTime: sourceEntry.endTime,
            timeZone: sourceEntry.timeZone,
            rosterStatus: sourceEntry.rosterStatus,
            notes: sourceEntry.notes,
            createdBy: user.loginName,
            updatedBy: user.loginName,
          },
        });
        copiedCount++;
      } catch {
        // Skip conflicts
      }
    }

    await AuditService.log({
      entityType: "ROSTER_ENTRY",
      entityId: input.personId,
      action: "COPY_PERSON_SHIFT",
      newValue: {
        sourceDate: input.sourceDate,
        targetDates: input.targetDates,
        copiedCount,
      },
      performedBy: user.loginName,
    });

    SyncService.triggerAutoSync(
      [{ personId: input.personId, supportGroupId: input.supportGroupId }],
      user.loginName
    );

    return { copiedCount };
  }
}
