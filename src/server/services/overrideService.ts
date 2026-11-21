import { prisma } from "@/lib/database";
import { OverrideState } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { AuditService } from "./auditService";
import { SessionUser } from "../auth/session";
import { AuthorizationService } from "../authorization/service";
import { SyncService } from "./syncService";

export interface CreateOverrideInput {
  personId: string;
  supportGroupId?: string;
  supportGroupIds?: string[];
  applyToAllGroups?: boolean;
  overrideState: OverrideState;
  startAt: string; // ISO string
  expiresAt?: string | null; // ISO string
  reason: string;
}

export class OverrideService {
  public static async create(input: CreateOverrideInput, user: SessionUser) {
    let targetGroupIds: string[] = [];

    if (input.applyToAllGroups) {
      const memberships = await prisma.personSupportGroup.findMany({
        where: { personId: input.personId, active: true },
        select: { supportGroupId: true },
      });
      targetGroupIds = memberships.map((m) => m.supportGroupId);
    } else if (input.supportGroupIds && input.supportGroupIds.length > 0) {
      targetGroupIds = input.supportGroupIds;
    } else if (input.supportGroupId) {
      targetGroupIds = [input.supportGroupId];
    }

    if (targetGroupIds.length === 0) {
      throw new ValidationError("No support groups found for this person");
    }

    for (const gid of targetGroupIds) {
      AuthorizationService.assertCanManageSupportGroup(user, gid);
    }

    const batchId =
      targetGroupIds.length > 1
        ? `batch-ov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        : undefined;

    const created = await prisma.$transaction(
      targetGroupIds.map((gid) =>
        prisma.availabilityOverride.create({
          data: {
            personId: input.personId,
            supportGroupId: gid,
            batchId,
            overrideState: input.overrideState,
            startAt: new Date(input.startAt),
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            reason: input.reason,
            createdBy: user.loginName,
          },
          include: {
            person: true,
            supportGroup: true,
          },
        })
      )
    );

    for (const ov of created) {
      await AuditService.log({
        entityType: "AVAILABILITY_OVERRIDE",
        entityId: ov.id,
        action: "CREATE",
        newValue: ov,
        performedBy: user.loginName,
      });
    }

    SyncService.triggerAutoSync(
      created.map((o) => ({ personId: o.personId, supportGroupId: o.supportGroupId })),
      user.loginName
    );

    return targetGroupIds.length === 1 ? created[0] : created;
  }

  public static async cancel(id: string, user: SessionUser) {
    const existing = await prisma.availabilityOverride.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Override ${id} not found`);
    }

    AuthorizationService.assertCanManageSupportGroup(user, existing.supportGroupId);

    const cancelled = await prisma.availabilityOverride.update({
      where: { id },
      data: {
        cancelledAt: new Date(),
        cancelledBy: user.loginName,
      },
    });

    await AuditService.log({
      entityType: "AVAILABILITY_OVERRIDE",
      entityId: id,
      action: "CANCEL",
      oldValue: existing,
      newValue: cancelled,
      performedBy: user.loginName,
    });

    SyncService.triggerAutoSync(
      [{ personId: existing.personId, supportGroupId: existing.supportGroupId }],
      user.loginName
    );

    return cancelled;
  }

  public static async cancelPersonActiveOverrides(personId: string, user: SessionUser) {
    const now = new Date();
    const active = await prisma.availabilityOverride.findMany({
      where: {
        personId,
        cancelledAt: null,
        startAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    if (active.length === 0) return { count: 0 };

    for (const ov of active) {
      AuthorizationService.assertCanManageSupportGroup(user, ov.supportGroupId);
    }

    const cancelledDate = new Date();
    await prisma.availabilityOverride.updateMany({
      where: { id: { in: active.map((a) => a.id) } },
      data: {
        cancelledAt: cancelledDate,
        cancelledBy: user.loginName,
      },
    });

    for (const ov of active) {
      await AuditService.log({
        entityType: "AVAILABILITY_OVERRIDE",
        entityId: ov.id,
        action: "CANCEL",
        oldValue: ov,
        performedBy: user.loginName,
      });
    }

    SyncService.triggerAutoSync(
      active.map((a) => ({ personId: a.personId, supportGroupId: a.supportGroupId })),
      user.loginName
    );

    return { count: active.length };
  }

  public static async getActiveOverrides(supportGroupId?: string) {
    const now = new Date();
    return prisma.availabilityOverride.findMany({
      where: {
        ...(supportGroupId ? { supportGroupId } : {}),
        cancelledAt: null,
        startAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        person: true,
        supportGroup: true,
      },
      orderBy: { startAt: "desc" },
    });
  }

  public static async getActiveOverridesForPerson(personId: string) {
    const now = new Date();
    return prisma.availabilityOverride.findMany({
      where: {
        personId,
        cancelledAt: null,
        startAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        supportGroup: true,
      },
      orderBy: { startAt: "desc" },
    });
  }
}
