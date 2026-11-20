import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { DirectorySyncService } from "@/server/services/directorySyncService";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || undefined;
    const company = searchParams.get("company") || undefined;
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    const results = await DirectorySyncService.searchHelixSupportGroups(
      query,
      company,
      limit
    );

    return NextResponse.json({ results });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to search BMC Helix support groups";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
