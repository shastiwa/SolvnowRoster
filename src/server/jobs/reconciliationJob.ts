import { prisma } from "@/lib/database";
import { SyncService } from "../services/syncService";
import { SafeLogger } from "../logging/logger";

let isReconciling = false;

export class ReconciliationJob {
  public static async run(
    performedBy: string = "scheduler"
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (isReconciling) {
      SafeLogger.warn("Reconciliation job skipped: already running");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    isReconciling = true;
    const correlationId = `recon-${Date.now()}`;
    const startedAt = new Date();

    const job = await prisma.jobExecution.create({
      data: {
        jobType: "RECONCILIATION",
        status: "RUNNING",
        startedAt,
        correlationId,
      },
    });

    try {
      SafeLogger.info("Starting periodic reconciliation job", { correlationId });

      // Sync all active support groups
      const results = await SyncService.syncAll({
        correlationId,
        performedBy,
        dryRun: false,
      });

      const succeeded = results.filter((r) => r.result === "SUCCESS").length;
      const failed = results.filter((r) => r.result === "FAILURE").length;

      await prisma.jobExecution.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          processedCount: results.length,
          succeededCount: succeeded,
          failedCount: failed,
        },
      });

      SafeLogger.info("Periodic reconciliation completed", {
        correlationId,
        processed: results.length,
        succeeded,
        failed,
      });

      return {
        processed: results.length,
        succeeded,
        failed,
      };
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Reconciliation job encountered error";

      await prisma.jobExecution.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: errorMsg,
        },
      });

      SafeLogger.error("Reconciliation job failed", err, { correlationId });
      return { processed: 0, succeeded: 0, failed: 1 };
    } finally {
      isReconciling = false;
    }
  }
}
