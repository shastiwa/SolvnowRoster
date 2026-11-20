import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { RosterService } from "@/server/services/rosterService";
import { CreateRosterEntrySchema } from "@/server/validation/schemas";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supportGroupId = searchParams.get("supportGroupId");
  const personId = searchParams.get("personId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate query parameters are required" },
      { status: 400 }
    );
  }

  if (personId) {
    const entries = await RosterService.getPersonRoster(personId, startDate, endDate);
    return NextResponse.json(entries);
  }

  if (!supportGroupId) {
    return NextResponse.json(
      { error: "supportGroupId or personId is required" },
      { status: 400 }
    );
  }

  const entries = await RosterService.getRoster(supportGroupId, startDate, endDate);
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const validated = CreateRosterEntrySchema.parse(body);
    const entry = await RosterService.createEntry(validated, user);

    return NextResponse.json(entry, { status: 201 });
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
