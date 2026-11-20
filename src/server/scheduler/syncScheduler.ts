import { SyncService } from "@/server/services/syncService";
import { SafeLogger } from "@/server/logging/logger";
import { getAppConfig } from "@/lib/config";

declare global {
  var __bmcSyncSchedulerInterval: NodeJS.Timeout | null | undefined;
  var __bmcSyncSchedulerRunning: boolean | undefined;
}

export interface SchedulerStatus {
  enabled: boolean;
  active: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  isRunningCycle: boolean;
}

let lastSchedulerRunAt: Date | null = null;

export function getSchedulerStatus(): SchedulerStatus {
  const config = getAppConfig();
  return {
    enabled: config.BMC_SYNC_ENABLED,
    active: Boolean(globalThis.__bmcSyncSchedulerInterval),
    intervalMinutes: config.BMC_SYNC_INTERVAL_MINUTES || 5,
    lastRunAt: lastSchedulerRunAt ? lastSchedulerRunAt.toISOString() : null,
    isRunningCycle: Boolean(globalThis.__bmcSyncSchedulerRunning),
  };
}

export function startSyncScheduler(): void {
  const config = getAppConfig();

  if (!config.BMC_SYNC_ENABLED) {
    SafeLogger.info("BMC Helix periodic sync is disabled (BMC_SYNC_ENABLED=false)");
    return;
  }

  if (globalThis.__bmcSyncSchedulerInterval) {
    return; // Already initialized
  }

  const intervalMinutes = config.BMC_SYNC_INTERVAL_MINUTES || 5;
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  SafeLogger.info(
    `Starting BMC Helix periodic availability sync scheduler (running every ${intervalMinutes} minutes)`
  );

  globalThis.__bmcSyncSchedulerInterval = setInterval(async () => {
    if (globalThis.__bmcSyncSchedulerRunning) {
      SafeLogger.warn("Previous scheduled sync cycle still in progress; skipping tick");
      return;
    }

    try {
      globalThis.__bmcSyncSchedulerRunning = true;
      lastSchedulerRunAt = new Date();
      SafeLogger.info("Executing periodic scheduled availability sync cycle...");

      const results = await SyncService.syncAll({
        dryRun: false,
        performedBy: "scheduled-job",
      });

      const updatedCount = results.filter(
        (r) => r.operationAttempted === "UPDATE" && r.result === "SUCCESS"
      ).length;

      SafeLogger.info("Periodic scheduled availability sync cycle completed", {
        evaluatedCount: results.length,
        updatedCount,
      });
    } catch (err: any) {
      SafeLogger.error("Error during scheduled availability sync cycle", {
        error: err.message,
      });
    } finally {
      globalThis.__bmcSyncSchedulerRunning = false;
    }
  }, intervalMs);
}

export function stopSyncScheduler(): void {
  if (globalThis.__bmcSyncSchedulerInterval) {
    clearInterval(globalThis.__bmcSyncSchedulerInterval);
    globalThis.__bmcSyncSchedulerInterval = null;
    SafeLogger.info("BMC Helix periodic sync scheduler stopped");
  }
}
