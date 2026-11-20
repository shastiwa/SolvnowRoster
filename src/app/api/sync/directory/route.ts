import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import { DirectorySyncService } from "@/server/services/directorySyncService";
import { AppError } from "@/lib/errors";

export async function POST() {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertCanExecuteSync(user);

    const report = await DirectorySyncService.execute(user.loginName);
    return NextResponse.json({
      ...report,
      syncedGroups: report.managedGroupsProcessed ?? report.unchangedCount ?? 0,
      syncedPeople:
        report.importedCount + report.updatedCount + report.unchangedCount,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Directory sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
