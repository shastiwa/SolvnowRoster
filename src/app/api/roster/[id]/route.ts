import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { RosterService } from "@/server/services/rosterService";
import { UpdateRosterEntrySchema } from "@/server/validation/schemas";
import { AppError } from "@/lib/errors";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const body = await req.json();

    const validated = UpdateRosterEntrySchema.parse(body);
    const updated = await RosterService.updateEntry(id, validated, user);

    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    await RosterService.deleteEntry(id, user);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
