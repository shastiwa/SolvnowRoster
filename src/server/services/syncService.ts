import { prisma } from "@/lib/database";
import { getBmcProvider } from "@/integrations/bmc-helix/client";
import { AvailabilityService } from "./availabilityService";
import { AuditService } from "./auditService";
import { SafeLogger } from "../logging/logger";
import { getAppConfig } from "@/lib/config";
import { SyncResult } from "@prisma/client";

// In-memory mutex for preventing concurrent sync on the same person+supportGroup
const activeSyncLocks = new Set<string>();

export interface SyncOptions {
  dryRun?: boolean;
  correlationId?: string;
  performedBy?: string;
}

export interface SyncTargetResult {
  personId: string;
  supportGroupId: string;
  previousAvailability: boolean | null;
  desiredAvailability: boolean;
  effectiveSource: string;
  actionPolicy: string;
  operationAttempted: string;
  result: SyncResult;
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  correlationId: string;
}

export class SyncService {
  /**
   * Synchronizes availability for a specific (Person, SupportGroup).
   */
  public static async syncPersonGroup(
    personId: string,
    supportGroupId: string,
    options: SyncOptions = {}
  ): Promise<SyncTargetResult> {
    const lockKey = `${personId}:${supportGroupId}`;
    if (activeSyncLocks.has(lockKey)) {
      throw new Error(`Sync already in progress for target ${lockKey}`);
    }
    activeSyncLocks.add(lockKey);

    const config = getAppConfig();
    const isDryRun = options.dryRun ?? config.SYNC_DRY_RUN;
    const correlationId =
      options.correlationId ??
      `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const performedBy = options.performedBy ?? "system";
    const startedAt = new Date();

    try {
      // 1. Fetch person and group identifiers for BMC mapping
      const person = await prisma.person.findUnique({ where: { id: personId } });
      const group = await prisma.supportGroup.findUnique({
        where: { id: supportGroupId },
      });

      if (!person || !group) {
        throw new Error("Person or Support Group not found in database");
      }

      // 2. Evaluate desired availability
      const evalResult = await AvailabilityService.evaluate(
        personId,
        supportGroupId,
        new Date()
      );

      // 3. Get current BMC availability
      const membership = await prisma.personSupportGroup.findUnique({
        where: {
          personId_supportGroupId: {
            personId,
            supportGroupId,
          },
        },
      });

      const previousAvailability = membership?.currentBmcAvailability ?? null;
      const desired = evalResult.desiredAvailability;

      // 4. Determine required action
      const needsUpdate =
        evalResult.actionPolicy === "UPDATE_REQUIRED" &&
        previousAvailability !== desired;

      // Case A: Missing roster policy skipped
      if (evalResult.actionPolicy === "SKIPPED") {
        const record = await prisma.syncHistory.create({
          data: {
            personId,
            supportGroupId,
            syncType: isDryRun ? "DRY_RUN" : "AVAILABILITY",
            previousAvailability,
            desiredAvailability: desired,
            effectiveSource: evalResult.effectiveSource,
            operation: "NO_CHANGE",
            result: isDryRun ? "DRY_RUN" : "SKIPPED",
            errorMessage: evalResult.reason,
            retryCount: 0,
            correlationId,
            startedAt,
            completedAt: new Date(),
          },
        });

        return {
          personId,
          supportGroupId,
          previousAvailability,
          desiredAvailability: desired,
          effectiveSource: evalResult.effectiveSource,
          actionPolicy: evalResult.actionPolicy,
          operationAttempted: "NO_CHANGE",
          result: record.result,
          retryCount: 0,
          correlationId,
        };
      }

      // Case B: No update required (already matching)
      if (!needsUpdate) {
        const record = await prisma.syncHistory.create({
          data: {
            personId,
            supportGroupId,
            syncType: isDryRun ? "DRY_RUN" : "AVAILABILITY",
            previousAvailability,
            desiredAvailability: desired,
            effectiveSource: evalResult.effectiveSource,
            operation: "NO_CHANGE",
            result: isDryRun ? "DRY_RUN" : "SUCCESS",
            errorMessage: "Desired availability matches current BMC availability",
            retryCount: 0,
            correlationId,
            startedAt,
            completedAt: new Date(),
          },
        });

        return {
          personId,
          supportGroupId,
          previousAvailability,
          desiredAvailability: desired,
          effectiveSource: evalResult.effectiveSource,
          actionPolicy: "NO_CHANGE",
          operationAttempted: "NO_CHANGE",
          result: record.result,
          retryCount: 0,
          correlationId,
        };
      }

      // Case C: Update is required, but DRY_RUN is active
      if (isDryRun) {
        const record = await prisma.syncHistory.create({
          data: {
            personId,
            supportGroupId,
            syncType: "DRY_RUN",
            previousAvailability,
            desiredAvailability: desired,
            effectiveSource: evalResult.effectiveSource,
            operation: "PROPOSED_UPDATE",
            result: "DRY_RUN",
            errorMessage: `Dry run: Would update BMC from ${previousAvailability} to ${desired} (${evalResult.reason})`,
            retryCount: 0,
            correlationId,
            startedAt,
            completedAt: new Date(),
          },
        });

        return {
          personId,
          supportGroupId,
          previousAvailability,
          desiredAvailability: desired,
          effectiveSource: evalResult.effectiveSource,
          actionPolicy: "UPDATE_REQUIRED",
          operationAttempted: "PROPOSED_UPDATE",
          result: "DRY_RUN",
          retryCount: 0,
          correlationId,
        };
      }

      // Case D: Live execution via BMC Provider
      const bmc = getBmcProvider();
      const updateResult = await bmc.availability.setAvailability(
        person.bmcPersonId,
        group.bmcSupportGroupId,
        desired,
        correlationId
      );

      if (updateResult.status === "CONFIGURATION_REQUIRED") {
        await prisma.syncHistory.create({
          data: {
            personId,
            supportGroupId,
            syncType: "AVAILABILITY",
            previousAvailability,
            desiredAvailability: desired,
            effectiveSource: evalResult.effectiveSource,
            operation: "UPDATE",
            result: "CONFIGURATION_REQUIRED",
            httpStatus: updateResult.httpStatus,
            errorCode: updateResult.errorCode,
            errorMessage: updateResult.errorMessage,
            retryCount: 0,
            correlationId,
            startedAt,
            completedAt: new Date(),
          },
        });

        return {
          personId,
          supportGroupId,
          previousAvailability,
          desiredAvailability: desired,
          effectiveSource: evalResult.effectiveSource,
          actionPolicy: "UPDATE_REQUIRED",
          operationAttempted: "UPDATE",
          result: "CONFIGURATION_REQUIRED",
          httpStatus: updateResult.httpStatus,
          errorCode: updateResult.errorCode,
          errorMessage: updateResult.errorMessage,
          retryCount: 0,
          correlationId,
        };
      }

      if (!updateResult.success) {
        await prisma.syncHistory.create({
          data: {
            personId,
            supportGroupId,
            syncType: "AVAILABILITY",
            previousAvailability,
            desiredAvailability: desired,
            effectiveSource: evalResult.effectiveSource,
            operation: "UPDATE",
            result: "FAILURE",
            httpStatus: updateResult.httpStatus,
            errorCode: updateResult.errorCode,
            errorMessage: updateResult.errorMessage,
            retryCount: 0,
            correlationId,
            startedAt,
            completedAt: new Date(),
          },
        });

        return {
          personId,
          supportGroupId,
          previousAvailability,
          desiredAvailability: desired,
          effectiveSource: evalResult.effectiveSource,
          actionPolicy: "UPDATE_REQUIRED",
          operationAttempted: "UPDATE",
          result: "FAILURE",
          httpStatus: updateResult.httpStatus,
          errorCode: updateResult.errorCode,
          errorMessage: updateResult.errorMessage,
          retryCount: 0,
          correlationId,
        };
      }

      // ONLY on confirmed success: update local state and last-known BMC availability!
      await prisma.personSupportGroup.update({
        where: {
          personId_supportGroupId: {
            personId,
            supportGroupId,
          },
        },
        data: {
          currentBmcAvailability: desired,
          lastSyncedAt: new Date(),
        },
      });

      await prisma.availabilityState.update({
        where: {
          personId_supportGroupId: {
            personId,
            supportGroupId,
          },
        },
        data: {
          lastKnownBmcAvailability: desired,
          lastSuccessfulSyncAt: new Date(),
          lastSyncAttemptAt: new Date(),
        },
      });

      await prisma.syncHistory.create({
        data: {
          personId,
          supportGroupId,
          syncType: "AVAILABILITY",
          previousAvailability,
          desiredAvailability: desired,
          effectiveSource: evalResult.effectiveSource,
          operation: "UPDATE",
          result: "SUCCESS",
          httpStatus: updateResult.httpStatus ?? 200,
          retryCount: 0,
          correlationId,
          startedAt,
          completedAt: new Date(),
        },
      });

      await AuditService.log({
        entityType: "AVAILABILITY_SYNC",
        entityId: `${personId}:${supportGroupId}`,
        action: "SYNC_CONFIRMED",
        oldValue: { availability: previousAvailability },
        newValue: { availability: desired },
        performedBy,
        correlationId,
      });

      return {
        personId,
        supportGroupId,
        previousAvailability,
        desiredAvailability: desired,
        effectiveSource: evalResult.effectiveSource,
        actionPolicy: "UPDATE_REQUIRED",
        operationAttempted: "UPDATE",
        result: "SUCCESS",
        httpStatus: updateResult.httpStatus ?? 200,
        retryCount: 0,
        correlationId,
      };
    } finally {
      activeSyncLocks.delete(lockKey);
    }
  }

  /**
   * Synchronizes all members in a given support group.
   */
  public static async syncSupportGroup(
    supportGroupId: string,
    options: SyncOptions = {}
  ): Promise<SyncTargetResult[]> {
    const members = await prisma.personSupportGroup.findMany({
      where: {
        supportGroupId,
        active: true,
      },
    });

    const results: SyncTargetResult[] = [];
    for (const mem of members) {
      try {
        const res = await this.syncPersonGroup(
          mem.personId,
          supportGroupId,
          options
        );
        results.push(res);
      } catch (err) {
        SafeLogger.error("Failed to sync member in group", err, {
          personId: mem.personId,
          supportGroupId,
        });
      }
    }
    return results;
  }

  /**
   * Synchronizes all active support groups.
   */
  public static async syncAll(
    options: SyncOptions = {}
  ): Promise<SyncTargetResult[]> {
    const groups = await prisma.supportGroup.findMany({
      where: { active: true },
    });

    const results: SyncTargetResult[] = [];
    for (const g of groups) {
      const res = await this.syncSupportGroup(g.id, options);
      results.push(...res);
    }
    return results;
  }

  /**
   * Retries an eligible failed synchronization record.
   */
  public static async retry(
    syncHistoryId: string,
    performedBy: string = "system"
  ) {
    const record = await prisma.syncHistory.findUnique({
      where: { id: syncHistoryId },
    });

    if (!record) {
      throw new Error(`SyncHistory record ${syncHistoryId} not found`);
    }

    if (record.result !== "FAILURE") {
      throw new Error(`Record ${syncHistoryId} is not a failed synchronization`);
    }

    // Check retry eligibility per Section 18
    const nonRetryableCodes = [
      "AUTHENTICATION_FAILED",
      "AUTHORIZATION_FAILED",
      "VALIDATION_FAILED",
      "CONFIGURATION_REQUIRED",
      "UNSUPPORTED_OPERATION",
    ];

    if (record.errorCode && nonRetryableCodes.includes(record.errorCode)) {
      throw new Error(
        `Error ${record.errorCode} is non-retryable without configuration or credential updates`
      );
    }

    if (!record.personId || !record.supportGroupId) {
      throw new Error("Cannot retry sync record without target person and group");
    }

    const config = getAppConfig();
    if (record.retryCount >= config.BMC_RETRY_LIMIT) {
      throw new Error(
        `Max retry limit (${config.BMC_RETRY_LIMIT}) exceeded for this record`
      );
    }

    const res = await this.syncPersonGroup(
      record.personId,
      record.supportGroupId,
      {
        performedBy,
        dryRun: false,
      }
    );

    await prisma.syncHistory.update({
      where: { id: syncHistoryId },
      data: {
        retryCount: record.retryCount + 1,
      },
    });

    await AuditService.log({
      entityType: "SYNC_HISTORY",
      entityId: syncHistoryId,
      action: "MANUAL_RETRY",
      newValue: res,
      performedBy,
    });

    return res;
  }
}
