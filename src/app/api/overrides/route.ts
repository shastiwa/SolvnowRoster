import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { OverrideService } from "@/server/services/overrideService";
import { CreateOverrideSchema } from "@/server/validation/schemas";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supportGroupId = searchParams.get("supportGroupId") || undefined;

  const overrides = await OverrideService.getActiveOverrides(supportGroupId);
  return NextResponse.json(overrides);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const validated = CreateOverrideSchema.parse(body);
    const override = await OverrideService.create(
      {
        personId: validated.personId,
        supportGroupId: validated.supportGroupId,
        overrideState: validated.overrideState,
        startAt: validated.startAt,
        expiresAt: validated.expiresAt,
        reason: validated.reason,
      },
      user
    );

    return NextResponse.json(override, { status: 201 });
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
