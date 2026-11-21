import { EffectiveSource, OverrideState, RosterStatus } from "@prisma/client";

export type MissingRosterPolicy =
  | "TAKE_NO_ACTION"
  | "KEEP_CURRENT_BMC_STATE"
  | "SET_UNAVAILABLE";

export interface AvailabilityEngineConfig {
  missingRosterPolicy: MissingRosterPolicy;
  onCallCountsAsAvailable: boolean;
  defaultTimeZone: string;
}

export interface RosterEntryCandidate {
  id: string;
  rosterDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timeZone: string;
  rosterStatus: RosterStatus;
}

export interface OverrideCandidate {
  id: string;
  overrideState: OverrideState;
  startAt: Date;
  expiresAt: Date | null;
  reason: string;
  cancelledAt: Date | null;
  previousAvailability?: boolean | null;
  restoredAt?: Date | null;
}

export interface AvailabilityCalculationInput {
  personId: string;
  supportGroupId: string;
  evalTimestamp: Date;
  rosterEntries: RosterEntryCandidate[];
  activeOverrides: OverrideCandidate[];
  unrestoredOverride?: OverrideCandidate | null;
  currentBmcAvailability?: boolean | null;
  config: AvailabilityEngineConfig;
}

export interface AvailabilityResult {
  personId: string;
  supportGroupId: string;
  desiredAvailability: boolean;
  effectiveSource: EffectiveSource;
  effectiveStart: Date | null;
  effectiveEnd: Date | null;
  reason: string;
  actionPolicy: "UPDATE_REQUIRED" | "NO_CHANGE" | "SKIPPED";
}
