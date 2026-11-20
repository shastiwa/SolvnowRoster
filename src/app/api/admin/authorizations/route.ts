import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import { prisma } from "@/lib/database";
import { AuditService } from "@/server/services/auditService";
import { SafeLogger } from "@/server/logging/logger";

export async function GET() {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertAdmin(user);

    const [managers, supportGroups, assignments] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ["ROSTER_MANAGER", "ROSTER_ADMIN"] }, active: true },
        select: { id: true, displayName: true, email: true, role: true },
        orderBy: { displayName: "asc" },
      }),
      prisma.supportGroup.findMany({
        where: { active: true },
        select: { id: true, company: true, organization: true, name: true },
        orderBy: [{ company: "asc" }, { name: "asc" }],
      }),
      prisma.managerSupportGroup.findMany({
        where: { active: true },
        include: {
          managerUser: { select: { id: true, displayName: true, email: true } },
          supportGroup: { select: { id: true, name: true, company: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      managers,
      supportGroups,
      assignments,
    });
  } catch (error: any) {
    SafeLogger.error("Failed to fetch authorizations", { error: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to fetch authorizations" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertAdmin(user);

    const body = await req.json();
    const { userId, supportGroupId } = body;

    if (!userId || !supportGroupId) {
      return NextResponse.json(
        { error: "User ID and Support Group ID are required" },
        { status: 400 }
      );
    }

    const assignment = await prisma.managerSupportGroup.upsert({
      where: {
        managerUserId_supportGroupId: {
          managerUserId: userId,
          supportGroupId,
        },
      },
      create: {
        managerUserId: userId,
        supportGroupId,
        active: true,
      },
      update: {
        active: true,
      },
      include: {
        managerUser: { select: { displayName: true, email: true } },
        supportGroup: { select: { name: true } },
      },
    });

    await AuditService.record({
      entityType: "AUTHORIZATION",
      entityId: assignment.id,
      action: "ASSIGN_MANAGER",
      newValue: {
        manager: assignment.managerUser.displayName,
        groupName: assignment.supportGroup.name,
      },
      performedBy: user.email,
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error: any) {
    SafeLogger.error("Failed to assign manager", { error: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to assign manager" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertAdmin(user);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Assignment ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.managerSupportGroup.findUnique({
      where: { id },
      include: {
        managerUser: { select: { displayName: true } },
        supportGroup: { select: { name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    await prisma.managerSupportGroup.delete({ where: { id } });

    await AuditService.record({
      entityType: "AUTHORIZATION",
      entityId: id,
      action: "REVOKE_MANAGER",
      oldValue: {
        manager: existing.managerUser.displayName,
        groupName: existing.supportGroup.name,
      },
      performedBy: user.email,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    SafeLogger.error("Failed to revoke manager assignment", {
      error: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to revoke assignment" },
      { status: error.status || 500 }
    );
  }
}
