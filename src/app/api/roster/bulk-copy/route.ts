import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { RosterService } from "@/server/services/rosterService";
import {
  BulkShiftAssignSchema,
  CopyPersonShiftSchema,
  CopyWeekRosterSchema,
} from "@/server/validation/schemas";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    if (body.type === "COPY_WEEK") {
      const validated = CopyWeekRosterSchema.parse(body);
      const res = await RosterService.copyWeek(validated, user);
      return NextResponse.json(res);
    }

    if (body.type === "COPY_PERSON") {
      const validated = CopyPersonShiftSchema.parse(body);
      const res = await RosterService.copyPersonShift(validated, user);
      return NextResponse.json(res);
    }

    if (body.type === "BULK_ASSIGN") {
      const validated = BulkShiftAssignSchema.parse(body);
      const res = await RosterService.bulkAssign(validated, user);
      return NextResponse.json(res);
    }

    return NextResponse.json(
      { error: "Invalid type. Must be COPY_WEEK, COPY_PERSON, or BULK_ASSIGN" },
      { status: 400 }
    );
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
