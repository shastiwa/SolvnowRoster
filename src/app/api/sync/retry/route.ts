import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import { SyncService } from "@/server/services/syncService";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertCanExecuteSync(user);

    const { syncHistoryId } = await req.json();
    if (!syncHistoryId) {
      return NextResponse.json(
        { error: "syncHistoryId is required" },
        { status: 400 }
      );
    }

    const result = await SyncService.retry(syncHistoryId, user.loginName);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Retry failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
