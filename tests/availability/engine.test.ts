import { describe, it, expect } from "vitest";
import { AvailabilityEngine } from "@/domain/availability/engine";
import {
  RosterEntryCandidate,
  OverrideCandidate,
  AvailabilityEngineConfig,
} from "@/domain/availability/types";
import { OverrideState, RosterStatus, EffectiveSource } from "@prisma/client";

describe("AvailabilityEngine", () => {
  const defaultConfig: AvailabilityEngineConfig = {
    missingRosterPolicy: "TAKE_NO_ACTION",
    onCallCountsAsAvailable: false,
    defaultTimeZone: "Asia/Kolkata",
  };

  const standardWorkingShift: RosterEntryCandidate = {
    id: "shift-1",
    rosterDate: "2026-03-10",
    startTime: "09:00",
    endTime: "17:00",
    timeZone: "Asia/Kolkata",
    rosterStatus: RosterStatus.WORKING,
  };

  it("1. Returns UNAVAILABLE before shift starts", () => {
    // 08:30 IST on 2026-03-10 is 03:00 UTC
    const checkTime = new Date("2026-03-10T03:00:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(false);
    expect(result.reason).toContain("Before scheduled shift start");
  });

  it("2. Returns AVAILABLE at exact shift start second", () => {
    // 09:00 IST is 03:30 UTC
    const checkTime = new Date("2026-03-10T03:30:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
    expect(result.effectiveSource).toBe(EffectiveSource.ROSTER);
  });

  it("3. Returns AVAILABLE during the shift", () => {
    // 12:00 IST is 06:30 UTC
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
  });

  it("4. Returns AVAILABLE one minute before shift end", () => {
    // 16:59 IST is 11:29 UTC
    const checkTime = new Date("2026-03-10T11:29:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
  });

  it("5. Returns UNAVAILABLE after shift ends", () => {
    // 17:30 IST is 12:00 UTC
    const checkTime = new Date("2026-03-10T12:00:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(false);
    expect(result.reason).toContain("After scheduled shift end");
  });

  // Overnight shift: 22:00 to 06:00 next day
  const overnightShift: RosterEntryCandidate = {
    id: "shift-overnight",
    rosterDate: "2026-03-10",
    startTime: "22:00",
    endTime: "06:00",
    timeZone: "Asia/Kolkata",
    rosterStatus: RosterStatus.WORKING,
  };

  it("6. Overnight shift: returns AVAILABLE before midnight on shift date", () => {
    // 23:30 IST on 2026-03-10 is 18:00 UTC
    const checkTime = new Date("2026-03-10T18:00:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [overnightShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
  });

  it("7. Overnight shift: returns AVAILABLE after midnight on next day", () => {
    // 03:00 IST on 2026-03-11 is 21:30 UTC on 2026-03-10
    const checkTime = new Date("2026-03-10T21:30:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [overnightShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
  });

  it("8. Overnight shift: returns UNAVAILABLE after shift ends next day", () => {
    // 07:00 IST on 2026-03-11 is 01:30 UTC on 2026-03-11
    const checkTime = new Date("2026-03-11T01:30:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [overnightShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(false);
  });

  it("9. Returns UNAVAILABLE when shift status is OFF", () => {
    const offShift: RosterEntryCandidate = {
      ...standardWorkingShift,
      rosterStatus: RosterStatus.OFF,
    };
    const checkTime = new Date("2026-03-10T06:30:00.000Z"); // 12:00 IST
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [offShift],
      activeOverrides: [],
      currentBmcAvailability: true,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(false);
    expect(result.reason).toContain("OFF");
  });

  it("10. Returns UNAVAILABLE when shift status is LEAVE", () => {
    const leaveShift: RosterEntryCandidate = {
      ...standardWorkingShift,
      rosterStatus: RosterStatus.LEAVE,
    };
    const checkTime = new Date("2026-03-10T06:30:00.000Z"); // 12:00 IST
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [leaveShift],
      activeOverrides: [],
      currentBmcAvailability: true,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(false);
    expect(result.reason).toContain("LEAVE");
  });

  it("11. Returns UNAVAILABLE when ON_CALL with default policy UNAVAILABLE", () => {
    const onCallShift: RosterEntryCandidate = {
      ...standardWorkingShift,
      rosterStatus: RosterStatus.ON_CALL,
    };
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [onCallShift],
      activeOverrides: [],
      currentBmcAvailability: true,
      config: { ...defaultConfig, onCallCountsAsAvailable: false },
    });

    expect(result.desiredAvailability).toBe(false);
  });

  it("12. Returns AVAILABLE when ON_CALL with policy AVAILABLE", () => {
    const onCallShift: RosterEntryCandidate = {
      ...standardWorkingShift,
      rosterStatus: RosterStatus.ON_CALL,
    };
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [onCallShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: { ...defaultConfig, onCallCountsAsAvailable: true },
    });

    expect(result.desiredAvailability).toBe(true);
  });

  it("13. Active Override AVAILABLE takes precedence over OFF shift", () => {
    const offShift: RosterEntryCandidate = {
      ...standardWorkingShift,
      rosterStatus: RosterStatus.OFF,
    };
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const activeOverride: OverrideCandidate = {
      id: "ov-1",
      overrideState: OverrideState.AVAILABLE,
      startAt: new Date("2026-03-10T05:00:00.000Z"),
      expiresAt: new Date("2026-03-10T08:00:00.000Z"),
      reason: "Emergency staffing cover",
      cancelledAt: null,
    };

    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [offShift],
      activeOverrides: [activeOverride],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
    expect(result.effectiveSource).toBe(EffectiveSource.OVERRIDE);
  });

  it("14. Active Override UNAVAILABLE takes precedence over WORKING shift", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const activeOverride: OverrideCandidate = {
      id: "ov-2",
      overrideState: OverrideState.UNAVAILABLE,
      startAt: new Date("2026-03-10T05:00:00.000Z"),
      expiresAt: new Date("2026-03-10T08:00:00.000Z"),
      reason: "Doctor appointment",
      cancelledAt: null,
    };

    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [activeOverride],
      currentBmcAvailability: true,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(false);
    expect(result.effectiveSource).toBe(EffectiveSource.OVERRIDE);
  });

  it("15. Expired override is ignored", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const expiredOverride: OverrideCandidate = {
      id: "ov-3",
      overrideState: OverrideState.UNAVAILABLE,
      startAt: new Date("2026-03-10T03:00:00.000Z"),
      expiresAt: new Date("2026-03-10T05:00:00.000Z"), // Ended before checkTime
      reason: "Early morning meeting",
      cancelledAt: null,
    };

    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [expiredOverride],
      currentBmcAvailability: true,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
    expect(result.effectiveSource).toBe(EffectiveSource.ROSTER);
  });

  it("16. Cancelled override is ignored", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const cancelledOverride: OverrideCandidate = {
      id: "ov-4",
      overrideState: OverrideState.UNAVAILABLE,
      startAt: new Date("2026-03-10T05:00:00.000Z"),
      expiresAt: new Date("2026-03-10T08:00:00.000Z"),
      reason: "Cancelled appointment",
      cancelledAt: new Date("2026-03-10T05:30:00.000Z"),
    };

    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [cancelledOverride],
      currentBmcAvailability: true,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
    expect(result.effectiveSource).toBe(EffectiveSource.ROSTER);
  });

  it("17. Missing roster entry with TAKE_NO_ACTION retains current BMC state", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [],
      activeOverrides: [],
      currentBmcAvailability: true,
      config: { ...defaultConfig, missingRosterPolicy: "TAKE_NO_ACTION" },
    });

    expect(result.desiredAvailability).toBe(true);
    expect(result.effectiveSource).toBe(EffectiveSource.MISSING_ROSTER_POLICY);
    expect(result.actionPolicy).toBe("SKIPPED");
  });

  it("18. Missing roster entry with SET_UNAVAILABLE sets availability to false", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [],
      activeOverrides: [],
      currentBmcAvailability: true,
      config: { ...defaultConfig, missingRosterPolicy: "SET_UNAVAILABLE" },
    });

    expect(result.desiredAvailability).toBe(false);
    expect(result.effectiveSource).toBe(EffectiveSource.MISSING_ROSTER_POLICY);
    expect(result.actionPolicy).toBe("UPDATE_REQUIRED");
  });

  it("19. Multi-group person: shift in Group A does not make person available in Group B", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const groupAResult = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-A",
      evalTimestamp: checkTime,
      rosterEntries: [standardWorkingShift],
      activeOverrides: [],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    const groupBResult = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-B",
      evalTimestamp: checkTime,
      rosterEntries: [], // No shift for Group B
      activeOverrides: [],
      currentBmcAvailability: false,
      config: { ...defaultConfig, missingRosterPolicy: "SET_UNAVAILABLE" },
    });

    expect(groupAResult.desiredAvailability).toBe(true);
    expect(groupBResult.desiredAvailability).toBe(false);
  });

  it("20. Multiple active overrides picks most recent start time", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const override1: OverrideCandidate = {
      id: "ov-old",
      overrideState: OverrideState.UNAVAILABLE,
      startAt: new Date("2026-03-10T04:00:00.000Z"),
      expiresAt: new Date("2026-03-10T08:00:00.000Z"),
      reason: "Old override",
      cancelledAt: null,
    };
    const override2: OverrideCandidate = {
      id: "ov-new",
      overrideState: OverrideState.AVAILABLE,
      startAt: new Date("2026-03-10T05:30:00.000Z"),
      expiresAt: new Date("2026-03-10T08:00:00.000Z"),
      reason: "Newer override",
      cancelledAt: null,
    };

    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [],
      activeOverrides: [override1, override2],
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(true);
    expect(result.reason).toContain("Newer override");
  });

  it("21. Restores to normal schedule (AVAILABLE) when out-of-shift override ends and person has no roster", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");
    const cancelledOverride: OverrideCandidate = {
      id: "ov-cancelled",
      overrideState: OverrideState.UNAVAILABLE,
      startAt: new Date("2026-03-10T04:00:00.000Z"),
      expiresAt: new Date("2026-03-10T08:00:00.000Z"),
      reason: "Out of shift",
      cancelledAt: new Date("2026-03-10T06:00:00.000Z"),
      previousAvailability: true,
      restoredAt: null,
    };

    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [],
      activeOverrides: [], // No active overrides
      unrestoredOverride: cancelledOverride,
      currentBmcAvailability: false, // Currently still false from the override
      config: defaultConfig, // TAKE_NO_ACTION
    });

    expect(result.desiredAvailability).toBe(true);
    expect(result.actionPolicy).toBe("UPDATE_REQUIRED");
    expect(result.reason).toContain("Override ended; restored to pre-override schedule (Available)");
  });

  it("22. Missing roster policy TAKE_NO_ACTION does not update when no ended override is pending restoration", () => {
    const checkTime = new Date("2026-03-10T06:30:00.000Z");

    const result = AvailabilityEngine.calculate({
      personId: "p-1",
      supportGroupId: "sg-1",
      evalTimestamp: checkTime,
      rosterEntries: [],
      activeOverrides: [],
      unrestoredOverride: null,
      currentBmcAvailability: false,
      config: defaultConfig,
    });

    expect(result.desiredAvailability).toBe(false);
    expect(result.actionPolicy).toBe("SKIPPED");
  });
});
