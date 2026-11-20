import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { SyncResult, SyncType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supportGroupId = searchParams.get("supportGroupId");
  const personId = searchParams.get("personId");
  const result = searchParams.get("result") as SyncResult | null;
  const syncType = searchParams.get("syncType") as SyncType | null;
  const correlationId = searchParams.get("correlationId");
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  const history = await prisma.syncHistory.findMany({
    where: {
      ...(supportGroupId ? { supportGroupId } : {}),
      ...(personId ? { personId } : {}),
      ...(result ? { result } : {}),
      ...(syncType ? { syncType } : {}),
      ...(correlationId ? { correlationId: { contains: correlationId } } : {}),
    },
    include: {
      person: { select: { id: true, fullName: true, loginId: true } },
      supportGroup: { select: { id: true, name: true, company: true } },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json(history);
}
