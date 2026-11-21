import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/lib/database";
import { OverrideService } from "@/server/services/overrideService";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId") || undefined;
    const personId = searchParams.get("personId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    // Fetch all active support groups for the group selector
    const groups = await prisma.supportGroup.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        company: true,
        organization: true,
        bmcSupportGroupId: true,
        _count: {
          select: { members: { where: { active: true } } },
        },
      },
      orderBy: [{ company: "asc" }, { organization: "asc" }, { name: "asc" }],
    });

    // Only fetch people for the selected support group (never dump the full list of all users)
    let people: any[] = [];
    if (groupId) {
      people = await prisma.person.findMany({
        where: {
          active: true,
          supportGroups: {
            some: {
              supportGroupId: groupId,
              active: true,
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          loginId: true,
          email: true,
          supportGroups: {
            where: { active: true },
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
    }

    let selectedPerson: any = null;

    if (personId) {
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

      selectedPerson = {
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
      };
    }

    return NextResponse.json({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        company: g.company,
        organization: g.organization,
        bmcSupportGroupId: g.bmcSupportGroupId,
        memberCount: g._count.members,
      })),
      people,
      selectedPerson,
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
