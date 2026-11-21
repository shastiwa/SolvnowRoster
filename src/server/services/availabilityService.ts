import { prisma } from "@/lib/database";
import { AvailabilityEngine } from "@/domain/availability/engine";
import {
  AvailabilityResult,
  MissingRosterPolicy,
} from "@/domain/availability/types";
import { getAppConfig } from "@/lib/config";
import { formatDateInTimeZone } from "@/lib/dates";

export class AvailabilityService {
  /**
   * Evaluates and records the current availability for a single person in a support group.
   */
  public static async evaluate(
    personId: string,
    supportGroupId: string,
    evalTimestamp: Date = new Date()
  ): Promise<AvailabilityResult> {
    const config = getAppConfig();

    // 1. Get current BMC availability record
    const membership = await prisma.personSupportGroup.findUnique({
      where: {
        personId_supportGroupId: {
          personId,
          supportGroupId,
        },
      },
    });

    const currentBmcAvailability = membership?.currentBmcAvailability ?? null;

    // 2. Fetch overrides
    const overrides = await prisma.availabilityOverride.findMany({
      where: {
        personId,
        supportGroupId,
        cancelledAt: null,
      },
    });

    // Check for any ended override that has not yet been marked as restored
    const unrestoredOverride = await prisma.availabilityOverride.findFirst({
      where: {
        personId,
        supportGroupId,
        restoredAt: null,
        OR: [
          { cancelledAt: { not: null } },
          { expiresAt: { lte: evalTimestamp } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    // 3. Fetch candidate roster entries (yesterday, today, tomorrow to cover overnight shifts)
    const todayStr = formatDateInTimeZone(evalTimestamp, config.DEFAULT_TIME_ZONE);
    const evalMs = evalTimestamp.getTime();
    const prevDateStr = formatDateInTimeZone(
      new Date(evalMs - 86400000),
      config.DEFAULT_TIME_ZONE
    );
    const nextDateStr = formatDateInTimeZone(
      new Date(evalMs + 86400000),
      config.DEFAULT_TIME_ZONE
    );

    const rosterEntries = await prisma.rosterEntry.findMany({
      where: {
        personId,
        supportGroupId,
        rosterDate: { in: [prevDateStr, todayStr, nextDateStr] },
      },
      orderBy: [{ rosterDate: "asc" }, { startTime: "asc" }],
    });

    // 4. Calculate with AvailabilityEngine
    const result = AvailabilityEngine.calculate({
      personId,
      supportGroupId,
      evalTimestamp,
      rosterEntries,
      activeOverrides: overrides,
      unrestoredOverride,
      currentBmcAvailability,
      config: {
        missingRosterPolicy: config.MISSING_ROSTER_POLICY as MissingRosterPolicy,
        onCallCountsAsAvailable: config.ON_CALL_COUNTS_AS_AVAILABLE,
        defaultTimeZone: config.DEFAULT_TIME_ZONE,
      },
    });

    // 5. Persist the evaluated availability state
    await prisma.availabilityState.upsert({
      where: {
        personId_supportGroupId: {
          personId,
          supportGroupId,
        },
      },
      create: {
        personId,
        supportGroupId,
        desiredAvailability: result.desiredAvailability,
        lastKnownBmcAvailability: currentBmcAvailability,
        effectiveSource: result.effectiveSource,
        calculationReason: result.reason,
        calculatedAt: evalTimestamp,
      },
      update: {
        desiredAvailability: result.desiredAvailability,
        lastKnownBmcAvailability: currentBmcAvailability,
        effectiveSource: result.effectiveSource,
        calculationReason: result.reason,
        calculatedAt: evalTimestamp,
      },
    });

    return result;
  }

  /**
   * Evaluates availability for all members of a support group.
   */
  public static async evaluateSupportGroup(
    supportGroupId: string,
    evalTimestamp: Date = new Date()
  ): Promise<AvailabilityResult[]> {
    const members = await prisma.personSupportGroup.findMany({
      where: {
        supportGroupId,
        active: true,
      },
      select: { personId: true },
    });

    const results: AvailabilityResult[] = [];
    for (const mem of members) {
      const res = await this.evaluate(mem.personId, supportGroupId, evalTimestamp);
      results.push(res);
    }

    return results;
  }
}
