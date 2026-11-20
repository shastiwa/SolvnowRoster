import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  const { userId, role } = await req.json();

  let targetUserId = userId;
  if (!targetUserId && role) {
    const user = await prisma.user.findFirst({
      where: { role: role as Role, active: true },
    });
    if (user) targetUserId = user.id;
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const response = NextResponse.json({ success: true, userId: targetUserId });
  response.cookies.set("roster_dev_user_id", targetUserId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 86400 * 7,
  });

  return response;
}
