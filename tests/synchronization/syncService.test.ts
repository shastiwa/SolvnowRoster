import { describe, it, expect, beforeEach } from "vitest";
import { SyncService } from "@/server/services/syncService";
import { prisma } from "@/lib/database";

describe("SyncService Integration Tests", () => {
  let testPersonId: string;
  let testGroupId: string;

  beforeEach(async () => {
    const group = await prisma.supportGroup.upsert({
      where: { bmcSupportGroupId: "TEST-GROUP-SYNC" },
      update: { active: true, name: "Test Sync Group" },
      create: {
        bmcSupportGroupId: "TEST-GROUP-SYNC",
        name: "Test Sync Group",
        company: "Test Company",
        organization: "Test Org",
        active: true,
      },
    });

    const person = await prisma.person.upsert({
      where: { bmcPersonId: "TEST-PERSON-SYNC" },
      update: { active: true, fullName: "Test Sync Person" },
      create: {
        bmcPersonId: "TEST-PERSON-SYNC",
        loginId: "test.sync.person",
        fullName: "Test Sync Person",
        email: "test.sync@solvnow.internal",
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
  });

  it("executes dry-run without mutating BMC availability", async () => {
    const result = await SyncService.syncPersonGroup(testPersonId, testGroupId, {
      dryRun: true,
      performedBy: "test@solvnow.internal",
    });

    expect(result.personId).toBe(testPersonId);
    expect(result.supportGroupId).toBe(testGroupId);
    expect(result.result).toBe("DRY_RUN");
  });

  it("records NO_CHANGE when desired availability already matches BMC state", async () => {
    // Set membership to match current desired availability
    const evalState = await prisma.availabilityState.findUnique({
      where: {
        personId_supportGroupId: {
          personId: testPersonId,
          supportGroupId: testGroupId,
        },
      },
    });

    if (evalState) {
      await prisma.personSupportGroup.update({
        where: {
          personId_supportGroupId: {
            personId: testPersonId,
            supportGroupId: testGroupId,
          },
        },
        data: { currentBmcAvailability: evalState.desiredAvailability },
      });
    }

    const result = await SyncService.syncPersonGroup(testPersonId, testGroupId, {
      dryRun: false,
      performedBy: "test@solvnow.internal",
    });

    expect(result.operationAttempted).toBe("NO_CHANGE");
  });
});
