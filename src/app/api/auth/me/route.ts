import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/lib/database";

export async function GET() {
  const user = await getCurrentUser();
  const allUsers = await prisma.user.findMany({
    orderBy: { role: "desc" },
    select: {
      id: true,
      loginName: true,
      displayName: true,
      role: true,
      email: true,
    },
  });

  return NextResponse.json({
    user,
    availableDevUsers: allUsers,
  });
}
