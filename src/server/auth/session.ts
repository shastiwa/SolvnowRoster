import { cookies } from "next/headers";
import { prisma } from "@/lib/database";
import { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  loginName: string;
  displayName: string;
  email: string;
  role: Role;
  managedGroupIds: string[];
}

export async function getCurrentUser(): Promise<SessionUser> {
  const cookieStore = await cookies();
  const devUserId = cookieStore.get("roster_dev_user_id")?.value;

  if (devUserId) {
    const user = await prisma.user.findUnique({
      where: { id: devUserId },
      include: {
        managedGroups: {
          where: { active: true },
          select: { supportGroupId: true },
        },
      },
    });

    if (user && user.active) {
      return {
        id: user.id,
        loginName: user.loginName,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        managedGroupIds: user.managedGroups.map((g) => g.supportGroupId),
      };
    }
  }

  // Fallback default dev user: Admin
  const defaultAdmin = await prisma.user.findFirst({
    where: { role: Role.ROSTER_ADMIN, active: true },
    include: {
      managedGroups: {
        where: { active: true },
        select: { supportGroupId: true },
      },
    },
  });

  if (defaultAdmin) {
    return {
      id: defaultAdmin.id,
      loginName: defaultAdmin.loginName,
      displayName: defaultAdmin.displayName,
      email: defaultAdmin.email,
      role: defaultAdmin.role,
      managedGroupIds: defaultAdmin.managedGroups.map((g) => g.supportGroupId),
    };
  }

  // System fallback if db not seeded yet
  return {
    id: "system-admin-default",
    loginName: "admin.solvnow",
    displayName: "Default Administrator",
    email: "admin@solvnow.local",
    role: Role.ROSTER_ADMIN,
    managedGroupIds: [],
  };
}
