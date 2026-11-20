import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RosterService } from "@/server/services/rosterService";
import { prisma } from "@/lib/database";
import { Role, RosterStatus } from "@prisma/client";
import { ValidationError, AuthorizationError } from "@/lib/errors";
import { SessionUser } from "@/server/auth/session";

describe("RosterService Overlap & Conflict Tests", () => {
  let testPersonId: string;
  let testGroupId: string;
  let adminUser: SessionUser;
  let unauthorizedManager: SessionUser;
  const testDate = "2026-11-25";

  beforeEach(async () => {
    // Ensure test group and person exist
    const group = await prisma.supportGroup.upsert({
      where: { bmcSupportGroupId: "TEST-GROUP-ROSTER" },
      update: { active: true, name: "Test Roster Group" },
      create: {
        bmcSupportGroupId: "TEST-GROUP-ROSTER",
        name: "Test Roster Group",
        company: "Test Company",
        organization: "Test Org",
        active: true,
      },
    });

    const person = await prisma.person.upsert({
      where: { bmcPersonId: "TEST-PERSON-ROSTER" },
      update: { active: true, fullName: "Test Roster Person" },
      create: {
        bmcPersonId: "TEST-PERSON-ROSTER",
        loginId: "test.roster.person",
        fullName: "Test Roster Person",
        email: "test.roster@solvnow.internal",
        active: true,
      },
    });

    await prisma.personSupportGroup.upsert({
      where: {
        personId_supportGroupId: {
          personId: person.id,
          supportGroupId: group.id,
        },
      },
      update: { active: true },
      create: {
        personId: person.id,
        supportGroupId: group.id,
        active: true,
      },
    });
    await prisma.personSupportGroup.upsert({
      where: {
        personId_supportGroupId: {
          personId: person.id,
          supportGroupId: group.id,
        },
      },
      update: { active: true },
      create: {
        personId: person.id,
        supportGroupId: group.id,
        active: true,
      },
    });

    testPersonId = person.id;
    testGroupId = group.id;

    adminUser = {
      id: "admin-user",
      loginName: "admin.solvnow",
      email: "admin@solvnow.internal",
      displayName: "System Administrator",
      role: Role.ROSTER_ADMIN,
      managedGroupIds: [testGroupId],
    };

    unauthorizedManager = {
      id: "unauth-manager",
      loginName: "unauth.manager",
      email: "other@solvnow.internal",
      displayName: "Other Manager",
      role: Role.ROSTER_MANAGER,
      managedGroupIds: ["other-group-id"],
    };

    // Clean up any test entries for this test date
    await prisma.rosterEntry.deleteMany({
      where: {
        personId: testPersonId,
        supportGroupId: testGroupId,
        rosterDate: testDate,
      },
    });
  });

  afterEach(async () => {
    // Clean up created test entries
    await prisma.rosterEntry.deleteMany({
      where: {
        personId: testPersonId,
        supportGroupId: testGroupId,
        rosterDate: testDate,
      },
    });
  });

  it("successfully creates a valid non-overlapping working shift", async () => {
    const entry = await RosterService.createEntry(
      {
        personId: testPersonId,
        supportGroupId: testGroupId,
        rosterDate: testDate,
        startTime: "09:00",
        endTime: "17:00",
        timeZone: "Asia/Kolkata",
        rosterStatus: RosterStatus.WORKING,
        notes: "Standard Day Shift",
      },
      adminUser
    );

    expect(entry).toBeDefined();
    expect(entry.id).toBeDefined();
    expect(entry.startTime).toBe("09:00");
    expect(entry.endTime).toBe("17:00");
    expect(entry.rosterStatus).toBe(RosterStatus.WORKING);
  });

  it("rejects an exact duplicate shift with ValidationError", async () => {
    await RosterService.createEntry(
      {
        personId: testPersonId,
        supportGroupId: testGroupId,
        rosterDate: testDate,
        startTime: "09:00",
        endTime: "17:00",
        timeZone: "Asia/Kolkata",
        rosterStatus: RosterStatus.WORKING,
      },
      adminUser
    );

    await expect(
      RosterService.createEntry(
        {
          personId: testPersonId,
          supportGroupId: testGroupId,
          rosterDate: testDate,
          startTime: "09:00",
          endTime: "17:00",
          timeZone: "Asia/Kolkata",
          rosterStatus: RosterStatus.WORKING,
        },
        adminUser
      )
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an overlapping working shift with ValidationError", async () => {
    // First shift: 09:00 to 17:00
    await RosterService.createEntry(
      {
        personId: testPersonId,
        supportGroupId: testGroupId,
        rosterDate: testDate,
        startTime: "09:00",
        endTime: "17:00",
        timeZone: "Asia/Kolkata",
        rosterStatus: RosterStatus.WORKING,
      },
      adminUser
    );

    // Overlapping shift: 14:00 to 22:00
    await expect(
      RosterService.createEntry(
        {
          personId: testPersonId,
          supportGroupId: testGroupId,
          rosterDate: testDate,
          startTime: "14:00",
          endTime: "22:00",
          timeZone: "Asia/Kolkata",
          rosterStatus: RosterStatus.WORKING,
        },
        adminUser
      )
    ).rejects.toThrow(ValidationError);
  });

  it("allows sequential, non-overlapping split shifts on the same date", async () => {
    const shift1 = await RosterService.createEntry(
      {
        personId: testPersonId,
        supportGroupId: testGroupId,
        rosterDate: testDate,
        startTime: "08:00",
        endTime: "12:00",
        timeZone: "Asia/Kolkata",
        rosterStatus: RosterStatus.WORKING,
      },
      adminUser
    );

    const shift2 = await RosterService.createEntry(
      {
        personId: testPersonId,
        supportGroupId: testGroupId,
        rosterDate: testDate,
        startTime: "16:00",
        endTime: "20:00",
        timeZone: "Asia/Kolkata",
        rosterStatus: RosterStatus.WORKING,
      },
      adminUser
    );

    expect(shift1.id).toBeDefined();
    expect(shift2.id).toBeDefined();
    expect(shift1.id).not.toBe(shift2.id);
  });

  it("enforces server-side authorization: rejects manager not assigned to support group", async () => {
    await expect(
      RosterService.createEntry(
        {
          personId: testPersonId,
          supportGroupId: testGroupId,
          rosterDate: testDate,
          startTime: "09:00",
          endTime: "17:00",
          timeZone: "Asia/Kolkata",
          rosterStatus: RosterStatus.WORKING,
        },
        unauthorizedManager
      )
    ).rejects.toThrow(AuthorizationError);
  });
});
