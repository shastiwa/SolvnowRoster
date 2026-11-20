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
    const { personId, supportGroupId, dryRun } = body;

    if (personId && supportGroupId) {
      const result = await SyncService.syncPersonGroup(personId, supportGroupId, {
        dryRun: dryRun ?? false,
        performedBy: user.loginName,
      });
      return NextResponse.json(result);
    }

    if (supportGroupId) {
      const results = await SyncService.syncSupportGroup(supportGroupId, {
        dryRun: dryRun ?? false,
        performedBy: user.loginName,
      });
      return NextResponse.json({ count: results.length, results });
    }

    // Sync all
    const results = await SyncService.syncAll({
      dryRun: dryRun ?? false,
      performedBy: user.loginName,
    });
    return NextResponse.json({ count: results.length, results });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Sync execution failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
