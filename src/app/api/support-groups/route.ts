import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/server/auth/session";
import { Role } from "@prisma/client";

export async function GET() {
  const user = await getCurrentUser();

  const supportGroups = await prisma.supportGroup.findMany({
    where: { active: true },
    include: {
      members: {
        where: { active: true },
        include: {
          person: true,
        },
      },
      managers: {
        where: { active: true },
        include: {
          managerUser: {
            select: { id: true, displayName: true, loginName: true },
          },
        },
      },
    },
    orderBy: [{ company: "asc" }, { organization: "asc" }, { name: "asc" }],
  });

  const formatted = supportGroups.map((sg) => {
    const isManaged =
      user.role === Role.ROSTER_ADMIN ||
      user.managedGroupIds.includes(sg.id);

    return {
      ...sg,
      isManagedByCurrentUser: isManaged,
      memberCount: sg.members.length,
    };
  });

  return NextResponse.json(formatted);
}
