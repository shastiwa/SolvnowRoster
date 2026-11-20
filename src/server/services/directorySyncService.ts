import { prisma } from "@/lib/database";
import { getBmcProvider } from "@/integrations/bmc-helix/client";
import { AuditService } from "./auditService";
import { SafeLogger } from "../logging/logger";
import { BmcSupportGroup } from "@/integrations/bmc-helix/types";

export interface DirectorySyncReport {
  jobId: string;
  correlationId: string;
  startedAt: Date;
  completedAt: Date;
  importedCount: number;
  updatedCount: number;
  unchangedCount: number;
  inactivatedCount: number;
  failedCount: number;
  status: "COMPLETED" | "FAILED" | "CONFIGURATION_REQUIRED";
  errorMessage?: string;
  managedGroupsProcessed?: number;
}

export interface HelixGroupSearchResult extends BmcSupportGroup {
  alreadyManaged: boolean;
  localId?: string;
  localMemberCount?: number;
}

export class DirectorySyncService {
  /**
   * Search support groups directly from BMC Helix (on-demand query without local persistence)
   */
  public static async searchHelixSupportGroups(
    query?: string,
    company?: string,
    limit: number = 25
  ): Promise<HelixGroupSearchResult[]> {
    const bmc = getBmcProvider();
    const groups = await bmc.directory.searchSupportGroups(query, company, limit);

    // Correlate with locally managed groups in SQLite
    const localGroups = await prisma.supportGroup.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    const localMap = new Map<string, { id: string; memberCount: number }>();
    for (const lg of localGroups) {
      localMap.set(lg.bmcSupportGroupId, {
        id: lg.id,
        memberCount: lg._count.members,
      });
    }

    return groups.map((g) => {
      const local = localMap.get(g.bmcSupportGroupId);
      return {
        ...g,
        alreadyManaged: !!local,
        localId: local?.id,
        localMemberCount: local?.memberCount,
      };
    });
  }

  /**
   * Option 2: Selective On-Demand Ingestion
   * Imports a specific Support Group and its direct members from BMC Helix into SQLite.
   */
  public static async importSupportGroup(
    bmcSupportGroupId: string,
    performedBy: string = "system"
  ) {
    const correlationId = `import-sg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const startedAt = new Date();
    const bmc = getBmcProvider();

    SafeLogger.info("Starting on-demand BMC Helix Support Group import", {
      bmcSupportGroupId,
      performedBy,
      correlationId,
    });

    // 1. Fetch Support Group from BMC
    let bmcGroup = await bmc.directory.getSupportGroup(bmcSupportGroupId);
    if (!bmcGroup) {
      // Fallback: try searching with the exact ID
      const searchRes = await bmc.directory.searchSupportGroups(bmcSupportGroupId, undefined, 1);
      bmcGroup = searchRes.find((g) => g.bmcSupportGroupId === bmcSupportGroupId) || null;
    }

    if (!bmcGroup) {
      throw new Error(`Support Group with ID "${bmcSupportGroupId}" not found in BMC Helix.`);
    }

    // 2. Upsert local Support Group
    const localGroup = await prisma.supportGroup.upsert({
      where: { bmcSupportGroupId: bmcGroup.bmcSupportGroupId },
      update: {
        name: bmcGroup.name,
        company: bmcGroup.company,
        organization: bmcGroup.organization,
        active: bmcGroup.active,
        lastSyncedAt: new Date(),
      },
      create: {
        bmcSupportGroupId: bmcGroup.bmcSupportGroupId,
        name: bmcGroup.name,
        company: bmcGroup.company,
        organization: bmcGroup.organization,
        active: bmcGroup.active,
        lastSyncedAt: new Date(),
      },
    });

    // 3. Fetch direct members from CTM:SupportGroupAssociation
    const bmcMembers = await bmc.directory.getSupportGroupMembers(bmcGroup.bmcSupportGroupId);
    const personIds = bmcMembers.map((m) => m.bmcPersonId).filter(Boolean);

    // 4. Fetch person details from CTM:People ONLY for these direct members
    const bmcPeople = await bmc.directory.getPeopleByIds(personIds);
    const personMap = new Map<string, string>(); // bmcPersonId -> local person.id

    for (const p of bmcPeople) {
      const localPerson = await prisma.person.upsert({
        where: { bmcPersonId: p.bmcPersonId },
        update: {
          loginId: p.loginId,
          fullName: p.fullName,
          email: p.email,
          active: p.active,
          lastSyncedAt: new Date(),
        },
        create: {
          bmcPersonId: p.bmcPersonId,
          loginId: p.loginId,
          fullName: p.fullName,
          email: p.email,
          active: p.active,
          lastSyncedAt: new Date(),
        },
      });
      personMap.set(p.bmcPersonId, localPerson.id);
    }

    // 5. Upsert memberships for this group
    const activeMemberPersonIds = new Set<string>();

    for (const m of bmcMembers) {
      const localPersonId = personMap.get(m.bmcPersonId);
      if (!localPersonId) continue;

      activeMemberPersonIds.add(localPersonId);

      await prisma.personSupportGroup.upsert({
        where: {
          personId_supportGroupId: {
            personId: localPersonId,
            supportGroupId: localGroup.id,
          },
        },
        update: {
          currentBmcAvailability: m.currentBmcAvailability,
          defaultGroup: m.defaultGroup,
          active: m.active,
          lastSyncedAt: new Date(),
        },
        create: {
          personId: localPersonId,
          supportGroupId: localGroup.id,
          currentBmcAvailability: m.currentBmcAvailability,
          defaultGroup: m.defaultGroup,
          active: m.active,
          lastSyncedAt: new Date(),
        },
      });
    }

    // 6. Inactivate missing memberships for this specific group
    const existingMemberships = await prisma.personSupportGroup.findMany({
      where: { supportGroupId: localGroup.id },
    });
    for (const em of existingMemberships) {
      if (!activeMemberPersonIds.has(em.personId) && em.active) {
        await prisma.personSupportGroup.update({
          where: { id: em.id },
          data: { active: false, lastSyncedAt: new Date() },
        });
      }
    }

    // 7. Audit and Sync History
    await prisma.syncHistory.create({
      data: {
        syncType: "DIRECTORY",
        operation: "IMPORT_GROUP",
        result: "SUCCESS",
        supportGroupId: localGroup.id,
        correlationId,
        startedAt,
        completedAt: new Date(),
      },
    });

    await AuditService.log({
      entityType: "SUPPORT_GROUP",
      entityId: localGroup.id,
      action: "IMPORT",
      newValue: {
        groupId: localGroup.id,
        groupName: localGroup.name,
        importedMembers: bmcMembers.length,
        importedPeople: bmcPeople.length,
      },
      performedBy,
      correlationId,
    });

    SafeLogger.info("BMC Helix Support Group import completed", {
      groupId: localGroup.id,
      groupName: localGroup.name,
      memberCount: bmcMembers.length,
    });

    return {
      success: true,
      group: localGroup,
      membersImported: bmcMembers.length,
      peopleImported: bmcPeople.length,
    };
  }

  /**
   * Option 2: Synchronize ONLY Managed Support Groups
   * Queries BMC Helix solely for groups currently managed in SQLite and their assigned members.
   * Never fetches the global corporate CTM:People table.
   */
  public static async execute(
    performedBy: string = "system"
  ): Promise<DirectorySyncReport> {
    const correlationId = `dir-sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const startedAt = new Date();

    const job = await prisma.jobExecution.create({
      data: {
        jobType: "DIRECTORY_SYNC",
        status: "RUNNING",
        startedAt,
        correlationId,
      },
    });

    const report: DirectorySyncReport = {
      jobId: job.id,
      correlationId,
      startedAt,
      completedAt: new Date(),
      importedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      inactivatedCount: 0,
      failedCount: 0,
      status: "COMPLETED",
      managedGroupsProcessed: 0,
    };

    try {
      const bmc = getBmcProvider();

      if (bmc.directory.implementationStatus === "CONFIGURATION_REQUIRED") {
        report.status = "CONFIGURATION_REQUIRED";
        report.errorMessage =
          "BMC Helix 26.2 directory integration details are not configured.";

        await prisma.jobExecution.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage: report.errorMessage,
          },
        });

        await prisma.syncHistory.create({
          data: {
            syncType: "DIRECTORY",
            operation: "DIRECTORY_IMPORT",
            result: "CONFIGURATION_REQUIRED",
            errorMessage: report.errorMessage,
            correlationId,
            completedAt: new Date(),
          },
        });

        return report;
      }

      // Query only currently registered Support Groups in SQLite
      const managedGroups = await prisma.supportGroup.findMany({
        where: { active: true },
      });

      report.managedGroupsProcessed = managedGroups.length;

      for (const group of managedGroups) {
        // 1. Refresh Support Group metadata
        let bmcGroup = await bmc.directory.getSupportGroup(group.bmcSupportGroupId);
        if (!bmcGroup) {
          const search = await bmc.directory.searchSupportGroups(group.bmcSupportGroupId, undefined, 1);
          bmcGroup = search.find((g) => g.bmcSupportGroupId === group.bmcSupportGroupId) || null;
        }

        if (!bmcGroup) {
          SafeLogger.warn(
            "Support group not found in active BMC Helix provider during sync, skipping member sync",
            { bmcSupportGroupId: group.bmcSupportGroupId }
          );
          continue;
        }

        const changed =
          group.name !== bmcGroup.name ||
          group.company !== bmcGroup.company ||
          group.organization !== bmcGroup.organization ||
          group.active !== bmcGroup.active;

        if (changed) {
          await prisma.supportGroup.update({
            where: { id: group.id },
            data: {
              name: bmcGroup.name,
              company: bmcGroup.company,
              organization: bmcGroup.organization,
              active: bmcGroup.active,
              lastSyncedAt: new Date(),
            },
          });
          report.updatedCount++;
        } else {
          await prisma.supportGroup.update({
            where: { id: group.id },
            data: { lastSyncedAt: new Date() },
          });
          report.unchangedCount++;
        }

        // 2. Fetch direct members for this managed group
        const bmcMembers = await bmc.directory.getSupportGroupMembers(group.bmcSupportGroupId);
        const personIds = bmcMembers.map((m) => m.bmcPersonId).filter(Boolean);

        // 3. Fetch profiles ONLY for these group members
        const bmcPeople = await bmc.directory.getPeopleByIds(personIds);
        const personMap = new Map<string, string>();

        for (const p of bmcPeople) {
          const existing = await prisma.person.findUnique({
            where: { bmcPersonId: p.bmcPersonId },
          });

          if (!existing) {
            const created = await prisma.person.create({
              data: {
                bmcPersonId: p.bmcPersonId,
                loginId: p.loginId,
                fullName: p.fullName,
                email: p.email,
                active: p.active,
                lastSyncedAt: new Date(),
              },
            });
            personMap.set(p.bmcPersonId, created.id);
            report.importedCount++;
          } else {
            personMap.set(p.bmcPersonId, existing.id);
            const changed =
              existing.fullName !== p.fullName ||
              existing.loginId !== p.loginId ||
              existing.email !== p.email ||
              existing.active !== p.active;

            if (changed) {
              await prisma.person.update({
                where: { id: existing.id },
                data: {
                  fullName: p.fullName,
                  loginId: p.loginId,
                  email: p.email,
                  active: p.active,
                  lastSyncedAt: new Date(),
                },
              });
              report.updatedCount++;
            } else {
              await prisma.person.update({
                where: { id: existing.id },
                data: { lastSyncedAt: new Date() },
              });
              report.unchangedCount++;
            }
          }
        }

        // 4. Update memberships for this group
        const activeMemberPersonIds = new Set<string>();

        for (const m of bmcMembers) {
          const localPersonId = personMap.get(m.bmcPersonId);
          if (!localPersonId) continue;

          activeMemberPersonIds.add(localPersonId);

          const existingMembership = await prisma.personSupportGroup.findUnique({
            where: {
              personId_supportGroupId: {
                personId: localPersonId,
                supportGroupId: group.id,
              },
            },
          });

          if (!existingMembership) {
            await prisma.personSupportGroup.create({
              data: {
                personId: localPersonId,
                supportGroupId: group.id,
                currentBmcAvailability: m.currentBmcAvailability,
                defaultGroup: m.defaultGroup,
                active: m.active,
                lastSyncedAt: new Date(),
              },
            });
            report.importedCount++;
          } else {
            const changed =
              existingMembership.currentBmcAvailability !== m.currentBmcAvailability ||
              existingMembership.defaultGroup !== m.defaultGroup ||
              existingMembership.active !== m.active;

            if (changed) {
              await prisma.personSupportGroup.update({
                where: { id: existingMembership.id },
                data: {
                  currentBmcAvailability: m.currentBmcAvailability,
                  defaultGroup: m.defaultGroup,
                  active: m.active,
                  lastSyncedAt: new Date(),
                },
              });
              report.updatedCount++;
            } else {
              await prisma.personSupportGroup.update({
                where: { id: existingMembership.id },
                data: { lastSyncedAt: new Date() },
              });
              report.unchangedCount++;
            }
          }
        }

        // Inactivate missing memberships within this group
        const localMemberships = await prisma.personSupportGroup.findMany({
          where: { supportGroupId: group.id },
        });
        for (const lm of localMemberships) {
          if (!activeMemberPersonIds.has(lm.personId) && lm.active) {
            await prisma.personSupportGroup.update({
              where: { id: lm.id },
              data: { active: false, lastSyncedAt: new Date() },
            });
            report.inactivatedCount++;
          }
        }
      }

      report.completedAt = new Date();
      report.status = "COMPLETED";

      await prisma.jobExecution.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: report.completedAt,
          processedCount:
            report.importedCount + report.updatedCount + report.unchangedCount,
          succeededCount: report.importedCount + report.updatedCount,
          skippedCount: report.unchangedCount,
          failedCount: report.failedCount,
        },
      });

      await prisma.syncHistory.create({
        data: {
          syncType: "DIRECTORY",
          operation: "DIRECTORY_IMPORT",
          result: "SUCCESS",
          retryCount: 0,
          correlationId,
          startedAt,
          completedAt: report.completedAt,
        },
      });

      await AuditService.log({
        entityType: "DIRECTORY_SYNC",
        entityId: job.id,
        action: "EXECUTE",
        newValue: report,
        performedBy,
        correlationId,
      });

      SafeLogger.info("Managed directory synchronization completed successfully", {
        correlationId,
        report,
      });

      return report;
    } catch (err: unknown) {
      report.status = "FAILED";
      report.failedCount++;
      report.completedAt = new Date();
      report.errorMessage =
        err instanceof Error ? err.message : "Directory synchronization failed";

      await prisma.jobExecution.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: report.completedAt,
          failedCount: 1,
          errorMessage: report.errorMessage,
        },
      });

      await prisma.syncHistory.create({
        data: {
          syncType: "DIRECTORY",
          operation: "DIRECTORY_IMPORT",
          result: "FAILURE",
          errorMessage: report.errorMessage,
          correlationId,
          startedAt,
          completedAt: report.completedAt,
        },
      });

      SafeLogger.error("Directory synchronization failed", err, {
        correlationId,
      });

      return report;
    }
  }

  /**
   * Remove/unmanage a support group from the roster application
   */
  public static async removeManagedSupportGroup(
    supportGroupId: string,
    performedBy: string = "system"
  ) {
    const group = await prisma.supportGroup.findUnique({
      where: { id: supportGroupId },
      include: {
        _count: {
          select: { rosterEntries: true },
        },
      },
    });

    if (!group) {
      throw new Error(`Support Group with ID ${supportGroupId} not found.`);
    }

    // Inactivate the group and memberships rather than hard deleting if shifts exist
    await prisma.personSupportGroup.updateMany({
      where: { supportGroupId },
      data: { active: false },
    });

    await prisma.supportGroup.update({
      where: { id: supportGroupId },
      data: { active: false },
    });

    await AuditService.log({
      entityType: "SUPPORT_GROUP",
      entityId: supportGroupId,
      action: "UNMANAGE",
      newValue: { groupName: group.name, active: false },
      performedBy,
    });

    return { success: true, message: `Support group ${group.name} is now unmanaged.` };
  }
}
