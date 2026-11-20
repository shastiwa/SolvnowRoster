import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/lib/database";
import { SafeLogger } from "@/server/logging/logger";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user.role === "ROSTER_USER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

    const where: any = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (search) {
      where.OR = [
        { entityId: { contains: search } },
        { performedBy: { contains: search } },
        { newValue: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    SafeLogger.error("Failed to query audit logs", { error: error.message });
    return NextResponse.json(
      { error: "Failed to query audit logs" },
      { status: 500 }
    );
  }
}
