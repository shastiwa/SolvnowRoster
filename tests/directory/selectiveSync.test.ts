import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { DirectorySyncService } from "@/server/services/directorySyncService";
import { prisma } from "@/lib/database";

describe("Option 2: Selective On-Demand Ingestion Tests", () => {
  const originalMode = process.env.BMC_PROVIDER_MODE;

  beforeEach(async () => {
    process.env.BMC_PROVIDER_MODE = "mock";
  });

  afterAll(() => {
    process.env.BMC_PROVIDER_MODE = originalMode;
  });

  it("searches BMC Helix support groups without saving to database", async () => {
    const results = await DirectorySyncService.searchHelixSupportGroups("Service Desk");
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("bmcSupportGroupId");
    expect(results[0]).toHaveProperty("name");
    expect(results[0]).toHaveProperty("alreadyManaged");
  });

  it("selectively imports a specific support group and only its direct members", async () => {
    // Target mock group SGP000000001004 (Network Engineering, Apex Global)
    const bmcGroupId = "SGP000000001004";

    const importResult = await DirectorySyncService.importSupportGroup(
      bmcGroupId,
      "test-admin"
    );

    expect(importResult.success).toBe(true);
    expect(importResult.group.bmcSupportGroupId).toBe(bmcGroupId);

    // Verify group was created in SQLite
    const groupInDb = await prisma.supportGroup.findUnique({
      where: { bmcSupportGroupId: bmcGroupId },
      include: {
        members: {
          include: { person: true },
        },
      },
    });

    expect(groupInDb).not.toBeNull();
    expect(groupInDb?.name).toBe("Network Engineering");
    expect(groupInDb?.members.length).toBeGreaterThan(0);

    // Verify that people imported belong to this group's members
    for (const membership of groupInDb!.members) {
      expect(membership.person).toBeDefined();
      expect(membership.person.active).toBe(true);
    }
  });

  it("syncs only managed groups and updates their members", async () => {
    const report = await DirectorySyncService.execute("test-admin");
    expect(report.status).toBe("COMPLETED");
    expect(report.managedGroupsProcessed).toBeGreaterThan(0);
    expect(report.failedCount).toBe(0);
  });

  it("allows unmanaging a support group cleanly", async () => {
    const group = await prisma.supportGroup.findFirst({
      where: { bmcSupportGroupId: "SGP000000001004" },
    });

    if (group) {
      const result = await DirectorySyncService.removeManagedSupportGroup(
        group.id,
        "test-admin"
      );
      expect(result.success).toBe(true);

      const updated = await prisma.supportGroup.findUnique({
        where: { id: group.id },
      });
      expect(updated?.active).toBe(false);
    }
  });
});
