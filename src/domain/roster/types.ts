import { RosterStatus } from "@prisma/client";

export interface CreateRosterEntryInput {
  personId: string;
  supportGroupId: string;
  rosterDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timeZone: string;
  rosterStatus: RosterStatus;
  notes?: string | null;
}

export interface UpdateRosterEntryInput {
  startTime?: string;
  endTime?: string;
  timeZone?: string;
  rosterStatus?: RosterStatus;
  notes?: string | null;
}

export interface BulkShiftAssignInput {
  supportGroupId: string;
  personIds: string[];
  dates: string[];
  startTime: string;
  endTime: string;
  timeZone: string;
  rosterStatus: RosterStatus;
  notes?: string | null;
}

export interface CopyWeekRosterInput {
  supportGroupId: string;
  sourceMonday: string; // YYYY-MM-DD
  targetMonday: string; // YYYY-MM-DD
}

export interface CopyPersonShiftInput {
  personId: string;
  supportGroupId: string;
  sourceDate: string;
  targetDates: string[];
}
