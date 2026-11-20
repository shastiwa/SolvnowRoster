import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import { DirectorySyncService } from "@/server/services/directorySyncService";
import { AppError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertCanExecuteSync(user);

    const { id } = await params;
    const result = await DirectorySyncService.removeManagedSupportGroup(
      id,
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
      err instanceof Error ? err.message : "Failed to unmanage support group";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
