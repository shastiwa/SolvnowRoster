import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function GET() {
  const people = await prisma.person.findMany({
    include: {
      supportGroups: {
        include: {
          supportGroup: true,
        },
      },
      availabilityStates: true,
    },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(people);
}
