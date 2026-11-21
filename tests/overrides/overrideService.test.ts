import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { OverrideService } from "@/server/services/overrideService";
import { prisma } from "@/lib/database";
import { OverrideState, Role } from "@prisma/client";
import { SessionUser } from "@/server/auth/session";

describe("OverrideService Multi-Group Tests", () => {
  let testPersonId: string;
  let testGroup1Id: string;
  let testGroup2Id: string;
  let adminUser: SessionUser;

  beforeEach(async () => {
    // Setup 2 test groups and 1 person associated with both
    const group1 = await prisma.supportGroup.upsert({
      where: { bmcSupportGroupId: "TEST-GROUP-OVERRIDE-1" },
      update: { active: true, name: "Test Override Group 1" },
      create: {
        bmcSupportGroupId: "TEST-GROUP-OVERRIDE-1",
        name: "Test Override Group 1",
        company: "Test Company",
        organization: "Test Org",
        active: true,
      },
    });
    testGroup1Id = group1.id;

    const group2 = await prisma.supportGroup.upsert({
      where: { bmcSupportGroupId: "TEST-GROUP-OVERRIDE-2" },
      update: { active: true, name: "Test Override Group 2" },
      create: {
        bmcSupportGroupId: "TEST-GROUP-OVERRIDE-2",
        name: "Test Override Group 2",
        company: "Test Company",
        organization: "Test Org",
        active: true,
      },
    });
    testGroup2Id = group2.id;

    const person = await prisma.person.upsert({
      where: { bmcPersonId: "TEST-PERSON-OVERRIDE" },
      update: { active: true, fullName: "Test Override Person" },
      create: {
        bmcPersonId: "TEST-PERSON-OVERRIDE",
        loginId: "test.override.person",
        fullName: "Test Override Person",
        email: "test.override@solvnow.internal",
        active: true,
      },
    });
    testPersonId = person.id;

    await prisma.availabilityOverride.deleteMany({ where: { personId: person.id } });

    await prisma.personSupportGroup.upsert({
      where: {
        personId_supportGroupId: {
          personId: person.id,
          supportGroupId: group1.id,
        },
      },
      update: { active: true },
      create: {
        personId: person.id,
        supportGroupId: group1.id,
        active: true,
      },
    });

    await prisma.personSupportGroup.upsert({
      where: {
        personId_supportGroupId: {
          personId: person.id,
          supportGroupId: group2.id,
        },
      },
      update: { active: true },
      create: {
        personId: person.id,
        supportGroupId: group2.id,
        active: true,
      },
    });

    adminUser = {
      id: "admin-user-id",
      loginName: "admin.solvnow",
      displayName: "Admin User",
      email: "admin@solvnow.internal",
      role: Role.ROSTER_ADMIN,
      managedGroupIds: [],
    };
  });

  afterAll(async () => {
    if (testGroup1Id && testGroup2Id && testPersonId) {
      await prisma.availabilityOverride.deleteMany({ where: { personId: testPersonId } });
      await prisma.syncHistory.deleteMany({ where: { supportGroupId: { in: [testGroup1Id, testGroup2Id] } } });
      await prisma.availabilityState.deleteMany({ where: { supportGroupId: { in: [testGroup1Id, testGroup2Id] } } });
      await prisma.personSupportGroup.deleteMany({ where: { personId: testPersonId } });
      await prisma.supportGroup.deleteMany({ where: { id: { in: [testGroup1Id, testGroup2Id] } } });
      await prisma.person.deleteMany({ where: { id: testPersonId } });
    }
  });

  it("creates overrides across all support groups when applyToAllGroups is true", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 4 * 3600 * 1000);

    const result = await OverrideService.create(
      {
        personId: testPersonId,
        applyToAllGroups: true,
        overrideState: OverrideState.UNAVAILABLE,
        startAt: now.toISOString(),
        expiresAt: future.toISOString(),
        reason: "Engineer going out of shift",
      },
      adminUser
    );

    expect(Array.isArray(result)).toBe(true);
    const overrides = result as any[];
    expect(overrides.length).toBe(2);
    expect(overrides[0].batchId).toBeDefined();
    expect(overrides[0].batchId).toBe(overrides[1].batchId);
    expect(overrides[0].overrideState).toBe(OverrideState.UNAVAILABLE);

    const activeOverrides = await OverrideService.getActiveOverridesForPerson(testPersonId);
    expect(activeOverrides.length).toBe(2);
  });

  it("creates overrides for selected supportGroupIds only", async () => {
    // Clear any previous overrides
    await prisma.availabilityOverride.deleteMany({ where: { personId: testPersonId } });

    const now = new Date();
    const future = new Date(now.getTime() + 4 * 3600 * 1000);

    const result = await OverrideService.create(
      {
        personId: testPersonId,
        supportGroupIds: [testGroup1Id],
        overrideState: OverrideState.UNAVAILABLE,
        startAt: now.toISOString(),
        expiresAt: future.toISOString(),
        reason: "Single group out-of-shift",
      },
      adminUser
    );

    const override = result as any;
    expect(override.id).toBeDefined();
    expect(override.supportGroupId).toBe(testGroup1Id);
  });

  it("cancels all active overrides for a person in 1 action (Restore Normal Schedule)", async () => {
    // Ensure active overrides exist
    const now = new Date();
    const future = new Date(now.getTime() + 4 * 3600 * 1000);

    await OverrideService.create(
      {
        personId: testPersonId,
        applyToAllGroups: true,
        overrideState: OverrideState.UNAVAILABLE,
        startAt: now.toISOString(),
        expiresAt: future.toISOString(),
        reason: "Engineer going out of shift",
      },
      adminUser
    );

    const cancelResult = await OverrideService.cancelPersonActiveOverrides(testPersonId, adminUser);
    expect(cancelResult.count).toBe(2);

    const remainingActive = await OverrideService.getActiveOverridesForPerson(testPersonId);
    expect(remainingActive.length).toBe(0);

    // Verify all overrides for this person are cancelled
    const cancelledOverrides = await prisma.availabilityOverride.findMany({
      where: { personId: testPersonId },
    });
    expect(cancelledOverrides.length).toBe(2);
    expect(cancelledOverrides.every((o) => o.cancelledAt !== null)).toBe(true);

    // Verify that AvailabilityService evaluates to restored schedule (AVAILABLE = true)
    const { AvailabilityService } = await import("@/server/services/availabilityService");
    const evalResult = await AvailabilityService.evaluate(testPersonId, testGroup1Id);
    expect(evalResult.desiredAvailability).toBe(true);
    expect(evalResult.actionPolicy).toBe("UPDATE_REQUIRED");
    expect(evalResult.reason).toContain("Override ended; restored to pre-override schedule (Available)");
  });
});
