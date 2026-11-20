import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import { DirectorySyncService } from "@/server/services/directorySyncService";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertCanExecuteSync(user);

    const body = await req.json();
    const { bmcSupportGroupId } = body;

    if (!bmcSupportGroupId || typeof bmcSupportGroupId !== "string") {
      return NextResponse.json(
        { error: "bmcSupportGroupId is required" },
        { status: 400 }
      );
    }

    const result = await DirectorySyncService.importSupportGroup(
      bmcSupportGroupId.trim(),
      user.loginName
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message =
      err instanceof Error ? err.message : "Support group import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
