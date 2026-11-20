import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/lib/database";
import { SafeLogger } from "@/server/logging/logger";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Filter support groups if manager
    let groupFilter: any = {};
    if (user.role === "ROSTER_MANAGER") {
      const managed = await prisma.managerSupportGroup.findMany({
        where: { managerUserId: user.id, active: true },
        select: { supportGroupId: true },
      });
      const managedIds = managed.map((m) => m.supportGroupId);
      groupFilter = { id: { in: managedIds } };
    }

    const [
      totalSupportGroups,
      totalPeople,
      totalRosteredToday,
      activeOverrides,
      recentSyncs,
      recentAudits,
      desiredAvailableCount,
      desiredUnavailableCount,
    ] = await Promise.all([
      prisma.supportGroup.count({ where: { active: true, ...groupFilter } }),
      prisma.person.count({ where: { active: true } }),
      prisma.rosterEntry.count({
        where: {
          rosterDate: todayStr,
          supportGroup: groupFilter.id ? groupFilter : undefined,
        },
      }),
      prisma.availabilityOverride.count({
        where: {
          cancelledAt: null,
          startAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          supportGroup: groupFilter.id ? groupFilter : undefined,
        },
      }),
      prisma.syncHistory.findMany({
        take: 6,
        orderBy: { startedAt: "desc" },
        include: {
          supportGroup: { select: { name: true } },
          person: { select: { fullName: true } },
        },
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { timestamp: "desc" },
      }),
      prisma.availabilityState.count({
        where: {
          desiredAvailability: true,
          supportGroup: groupFilter.id ? groupFilter : undefined,
        },
      }),
      prisma.availabilityState.count({
        where: {
          desiredAvailability: false,
          supportGroup: groupFilter.id ? groupFilter : undefined,
        },
      }),
    ]);

    return NextResponse.json({
      metrics: {
        totalSupportGroups,
        totalPeople,
        totalRosteredToday,
        activeOverrides,
        desiredAvailableCount,
        desiredUnavailableCount,
      },
      recentSyncs,
      recentAudits,
      timestamp: now.toISOString(),
      providerMode: process.env.BMC_PROVIDER_MODE || "mock",
      user: {
        id: user.id,
        name: user.displayName,
        role: user.role,
      },
    });
  } catch (error: any) {
    SafeLogger.error("Failed to load dashboard metrics", { error: error.message });
    return NextResponse.json(
      { error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
