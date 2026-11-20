import { ReconciliationJob } from "./reconciliationJob";
import { SafeLogger } from "../logging/logger";
import { getAppConfig } from "@/lib/config";

declare global {
  // eslint-disable-next-line no-var
  var __rosterSchedulerStarted: boolean | undefined;
}

export function initBackgroundScheduler(): void {
  const config = getAppConfig();

  if (!config.BMC_SYNC_ENABLED) {
    SafeLogger.info("Background synchronization scheduler is disabled by config (BMC_SYNC_ENABLED=false)");
    return;
  }

  if (global.__rosterSchedulerStarted) {
    return;
  }

  global.__rosterSchedulerStarted = true;
  const intervalMinutes = config.BMC_SYNC_INTERVAL_MINUTES || 5;
  const intervalMs = intervalMinutes * 60 * 1000;

  SafeLogger.info(`Starting in-process reconciliation scheduler (every ${intervalMinutes} min)`);

  setInterval(() => {
    ReconciliationJob.run("in-process-scheduler").catch((err) => {
      SafeLogger.error("Scheduler periodic execution caught exception", err);
    });
  }, intervalMs);
}
