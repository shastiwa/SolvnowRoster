import { EffectiveSource, OverrideState, RosterStatus } from "@prisma/client";
import { calculateShiftInterval } from "@/lib/dates";
import {
  AvailabilityCalculationInput,
  AvailabilityResult,
} from "./types";

export class AvailabilityEngine {
  /**
   * Calculates the desired availability for a specific (Person, SupportGroup) at a given timestamp.
   */
  public static calculate(input: AvailabilityCalculationInput): AvailabilityResult {
    const {
      personId,
      supportGroupId,
      evalTimestamp,
      rosterEntries,
      activeOverrides,
      currentBmcAvailability,
      config,
    } = input;

    const evalTime = evalTimestamp.getTime();

    // 1. Check for active manual overrides (takes precedence over roster)
    const validOverrides = activeOverrides
      .filter((o) => {
        if (o.cancelledAt) return false;
        const start = new Date(o.startAt).getTime();
        if (evalTime < start) return false;
        if (o.expiresAt) {
          const exp = new Date(o.expiresAt).getTime();
          if (evalTime >= exp) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    if (validOverrides.length > 0) {
      const topOverride = validOverrides[0];
      const isAvailable = topOverride.overrideState === OverrideState.AVAILABLE;
      const desiredAvailability = isAvailable;
      const actionPolicy =
        currentBmcAvailability === null || currentBmcAvailability === undefined
          ? "UPDATE_REQUIRED"
          : currentBmcAvailability !== desiredAvailability
          ? "UPDATE_REQUIRED"
          : "NO_CHANGE";

      return {
        personId,
        supportGroupId,
        desiredAvailability,
        effectiveSource: EffectiveSource.OVERRIDE,
        effectiveStart: new Date(topOverride.startAt),
        effectiveEnd: topOverride.expiresAt ? new Date(topOverride.expiresAt) : null,
        reason: `Active manual override (${topOverride.overrideState}): ${topOverride.reason}`,
        actionPolicy,
      };
    }

    // 2. Check roster entries
    // Evaluate shift intervals for candidate entries
    let activeRosterEntry: {
      entry: (typeof rosterEntries)[0];
      start: Date;
      end: Date;
    } | null = null;

    let closestRosterEntry: {
      entry: (typeof rosterEntries)[0];
      start: Date;
      end: Date;
    } | null = null;

    for (const entry of rosterEntries) {
      const { start, end } = calculateShiftInterval(
        entry.rosterDate,
        entry.startTime,
        entry.endTime,
        entry.timeZone || config.defaultTimeZone
      );

      const sTime = start.getTime();
      const eTime = end.getTime();

      // Shift is active if evalTime is within [start, end)
      // Exactly at shift start is active, exactly at shift end has ended
      if (evalTime >= sTime && evalTime < eTime) {
        activeRosterEntry = { entry, start, end };
        break;
      }

      // Check if entry is for the current day to provide accurate "Outside shift" reason
      if (!closestRosterEntry) {
        closestRosterEntry = { entry, start, end };
      }
    }

    if (activeRosterEntry) {
      const { entry, start, end } = activeRosterEntry;

      if (entry.rosterStatus === RosterStatus.WORKING) {
        const desiredAvailability = true;
        const actionPolicy =
          currentBmcAvailability === null || currentBmcAvailability === undefined
            ? "UPDATE_REQUIRED"
            : currentBmcAvailability !== desiredAvailability
            ? "UPDATE_REQUIRED"
            : "NO_CHANGE";

        return {
          personId,
          supportGroupId,
          desiredAvailability,
          effectiveSource: EffectiveSource.ROSTER,
          effectiveStart: start,
          effectiveEnd: end,
          reason: `Active WORKING shift (${entry.startTime}-${entry.endTime} ${entry.timeZone})`,
          actionPolicy,
        };
      }

      if (entry.rosterStatus === RosterStatus.OFF) {
        const desiredAvailability = false;
        const actionPolicy =
          currentBmcAvailability === null || currentBmcAvailability === undefined
            ? "UPDATE_REQUIRED"
            : currentBmcAvailability !== desiredAvailability
            ? "UPDATE_REQUIRED"
            : "NO_CHANGE";

        return {
          personId,
          supportGroupId,
          desiredAvailability,
          effectiveSource: EffectiveSource.ROSTER,
          effectiveStart: start,
          effectiveEnd: end,
          reason: `Rostered as OFF on ${entry.rosterDate}`,
          actionPolicy,
        };
      }

      if (entry.rosterStatus === RosterStatus.LEAVE) {
        const desiredAvailability = false;
        const actionPolicy =
          currentBmcAvailability === null || currentBmcAvailability === undefined
            ? "UPDATE_REQUIRED"
            : currentBmcAvailability !== desiredAvailability
            ? "UPDATE_REQUIRED"
            : "NO_CHANGE";

        return {
          personId,
          supportGroupId,
          desiredAvailability,
          effectiveSource: EffectiveSource.ROSTER,
          effectiveStart: start,
          effectiveEnd: end,
          reason: `Rostered on LEAVE on ${entry.rosterDate}`,
          actionPolicy,
        };
      }

      if (entry.rosterStatus === RosterStatus.ON_CALL) {
        const desiredAvailability = config.onCallCountsAsAvailable;
        const actionPolicy =
          currentBmcAvailability === null || currentBmcAvailability === undefined
            ? "UPDATE_REQUIRED"
            : currentBmcAvailability !== desiredAvailability
            ? "UPDATE_REQUIRED"
            : "NO_CHANGE";

        return {
          personId,
          supportGroupId,
          desiredAvailability,
          effectiveSource: EffectiveSource.ROSTER,
          effectiveStart: start,
          effectiveEnd: end,
          reason: `Rostered ON_CALL (${
            config.onCallCountsAsAvailable ? "counts as AVAILABLE" : "counts as UNAVAILABLE"
          } per policy)`,
          actionPolicy,
        };
      }
    }

    // 3. If there is a roster entry on this date or adjacent, but current time is before or after the shift
    if (closestRosterEntry) {
      const { entry, start, end } = closestRosterEntry;
      const desiredAvailability = false;
      const actionPolicy =
        currentBmcAvailability === null || currentBmcAvailability === undefined
          ? "UPDATE_REQUIRED"
          : currentBmcAvailability !== desiredAvailability
          ? "UPDATE_REQUIRED"
          : "NO_CHANGE";

      const timingReason =
        evalTime < start.getTime()
          ? `Before scheduled shift start (${entry.startTime} ${entry.timeZone})`
          : `After scheduled shift end (${entry.endTime} ${entry.timeZone})`;

      return {
        personId,
        supportGroupId,
        desiredAvailability,
        effectiveSource: EffectiveSource.ROSTER,
        effectiveStart: null,
        effectiveEnd: null,
        reason: timingReason,
        actionPolicy,
      };
    }

    // 4. Check for unrestored ended override
    // When an override ends (via cancellation or expiration) and the person has no active roster,
    // their availability must be restored: returning from an out-of-shift override restores to Available (true).
    if (input.unrestoredOverride) {
      const restoredAvailability =
        input.unrestoredOverride.overrideState === OverrideState.UNAVAILABLE
          ? true
          : (input.unrestoredOverride.previousAvailability ?? false);

      const actionPolicy =
        currentBmcAvailability === null || currentBmcAvailability === undefined
          ? "UPDATE_REQUIRED"
          : currentBmcAvailability !== restoredAvailability
          ? "UPDATE_REQUIRED"
          : "NO_CHANGE";

      return {
        personId,
        supportGroupId,
        desiredAvailability: restoredAvailability,
        effectiveSource: EffectiveSource.MISSING_ROSTER_POLICY,
        effectiveStart: null,
        effectiveEnd: null,
        reason: `Override ended; restored to pre-override schedule (${
          restoredAvailability ? "Available" : "Unavailable"
        })`,
        actionPolicy,
      };
    }

    // 5. Missing roster entry policy
    if (config.missingRosterPolicy === "TAKE_NO_ACTION") {
      return {
        personId,
        supportGroupId,
        desiredAvailability: currentBmcAvailability ?? false,
        effectiveSource: EffectiveSource.MISSING_ROSTER_POLICY,
        effectiveStart: null,
        effectiveEnd: null,
        reason: "No active roster entry; missing-roster policy is TAKE_NO_ACTION",
        actionPolicy: "SKIPPED",
      };
    }

    if (config.missingRosterPolicy === "KEEP_CURRENT_BMC_STATE") {
      return {
        personId,
        supportGroupId,
        desiredAvailability: currentBmcAvailability ?? false,
        effectiveSource: EffectiveSource.MISSING_ROSTER_POLICY,
        effectiveStart: null,
        effectiveEnd: null,
        reason: "No active roster entry; missing-roster policy is KEEP_CURRENT_BMC_STATE",
        actionPolicy: "NO_CHANGE",
      };
    }

    // "SET_UNAVAILABLE"
    const desiredAvailability = false;
    const actionPolicy =
      currentBmcAvailability === null || currentBmcAvailability === undefined
        ? "UPDATE_REQUIRED"
        : currentBmcAvailability !== desiredAvailability
        ? "UPDATE_REQUIRED"
        : "NO_CHANGE";

    return {
      personId,
      supportGroupId,
      desiredAvailability,
      effectiveSource: EffectiveSource.MISSING_ROSTER_POLICY,
      effectiveStart: null,
      effectiveEnd: null,
      reason: "No active roster entry; missing-roster policy is SET_UNAVAILABLE",
      actionPolicy,
    };
  }
}
