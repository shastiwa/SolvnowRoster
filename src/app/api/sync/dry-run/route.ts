import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import { SyncService } from "@/server/services/syncService";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertCanExecuteSync(user);

    const body = await req.json().catch(() => ({}));
    const { supportGroupId } = body;

    const results = supportGroupId
      ? await SyncService.syncSupportGroup(supportGroupId, {
          dryRun: true,
          performedBy: user.loginName,
        })
      : await SyncService.syncAll({
          dryRun: true,
          performedBy: user.loginName,
        });

    const evaluatedCount = results.length;
    const updatesRequiredCount = results.filter(
      (r) => r.actionPolicy === "UPDATE_REQUIRED"
    ).length;

    return NextResponse.json({
      mode: "DRY_RUN",
      count: results.length,
      evaluatedCount,
      updatesRequiredCount,
      results,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Dry-run failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
