import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/lib/database";
import { OverrideService } from "@/server/services/overrideService";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const personId = searchParams.get("personId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    // Fetch all people for the dropdown selector
    const allPeople = await prisma.person.findMany({
      where: { active: true },
      select: {
        id: true,
        fullName: true,
        loginId: true,
        email: true,
        supportGroups: {
          select: {
            supportGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
    });

    if (!personId) {
      return NextResponse.json({
        people: allPeople,
        selectedPerson: null,
      });
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        supportGroups: {
          where: { active: true },
          include: {
            supportGroup: true,
          },
        },
      },
    });

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const activeOverrides = await OverrideService.getActiveOverridesForPerson(personId);

    // Fetch shifts across all groups for this person
    const whereClause: any = { personId };
    if (startDate && endDate) {
      whereClause.rosterDate = { gte: startDate, lte: endDate };
    }

    const shifts = await prisma.rosterEntry.findMany({
      where: whereClause,
      include: {
        supportGroup: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
      },
      orderBy: [{ rosterDate: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({
      people: allPeople,
      selectedPerson: {
        id: person.id,
        fullName: person.fullName,
        loginId: person.loginId,
        email: person.email,
        supportGroups: person.supportGroups.map((psg) => ({
          id: psg.supportGroup.id,
          name: psg.supportGroup.name,
          company: psg.supportGroup.company,
          organization: psg.supportGroup.organization,
          bmcSupportGroupId: psg.supportGroup.bmcSupportGroupId,
          currentBmcAvailability: psg.currentBmcAvailability,
          defaultGroup: psg.defaultGroup,
        })),
        activeOverrides,
        shifts,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.safeMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
