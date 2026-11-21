import { z } from "zod";
import { OverrideState, RosterStatus, Role } from "@prisma/client";
import { isValidIanaTimeZone } from "@/lib/dates";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const CreateRosterEntrySchema = z
  .object({
    personId: z.string().min(1, "Person is required"),
    supportGroupId: z.string().min(1, "Support group is required"),
    rosterDate: z
      .string()
      .regex(dateRegex, "Roster date must be formatted as YYYY-MM-DD"),
    startTime: z
      .string()
      .regex(timeRegex, "Start time must be formatted as HH:mm"),
    endTime: z
      .string()
      .regex(timeRegex, "End time must be formatted as HH:mm"),
    timeZone: z
      .string()
      .refine(isValidIanaTimeZone, "Invalid IANA time zone"),
    rosterStatus: z.nativeEnum(RosterStatus),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      // Allow start === end only if explicitly not working or a 24h designation
      if (data.rosterStatus === RosterStatus.WORKING) {
        return data.startTime !== data.endTime;
      }
      return true;
    },
    {
      message: "Start time and end time cannot be identical for WORKING shifts",
      path: ["endTime"],
    }
  );

export const UpdateRosterEntrySchema = z
  .object({
    startTime: z.string().regex(timeRegex, "HH:mm format required").optional(),
    endTime: z.string().regex(timeRegex, "HH:mm format required").optional(),
    timeZone: z
      .string()
      .refine(isValidIanaTimeZone, "Invalid IANA time zone")
      .optional(),
    rosterStatus: z.nativeEnum(RosterStatus).optional(),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      if (
        data.startTime &&
        data.endTime &&
        data.rosterStatus === RosterStatus.WORKING
      ) {
        return data.startTime !== data.endTime;
      }
      return true;
    },
    {
      message: "Start time and end time cannot be identical for WORKING shifts",
      path: ["endTime"],
    }
  );

export const BulkShiftAssignSchema = z.object({
  supportGroupId: z.string().min(1, "Support group required"),
  personIds: z.array(z.string().min(1)).min(1, "At least one person required"),
  dates: z
    .array(z.string().regex(dateRegex, "YYYY-MM-DD format required"))
    .min(1, "At least one date required"),
  startTime: z.string().regex(timeRegex, "HH:mm format required"),
  endTime: z.string().regex(timeRegex, "HH:mm format required"),
  timeZone: z.string().refine(isValidIanaTimeZone, "Invalid IANA time zone"),
  rosterStatus: z.nativeEnum(RosterStatus),
  notes: z.string().max(500).optional(),
});

export const CopyWeekRosterSchema = z.object({
  supportGroupId: z.string().min(1, "Support group required"),
  sourceMonday: z.string().regex(dateRegex, "YYYY-MM-DD format required"),
  targetMonday: z.string().regex(dateRegex, "YYYY-MM-DD format required"),
});

export const CopyPersonShiftSchema = z.object({
  personId: z.string().min(1, "Person required"),
  supportGroupId: z.string().min(1, "Support group required"),
  sourceDate: z.string().regex(dateRegex, "YYYY-MM-DD format required"),
  targetDates: z
    .array(z.string().regex(dateRegex, "YYYY-MM-DD format required"))
    .min(1, "At least one target date required"),
});

export const CreateOverrideSchema = z
  .object({
    personId: z.string().min(1, "Person required"),
    supportGroupId: z.string().optional(),
    supportGroupIds: z.array(z.string()).optional(),
    applyToAllGroups: z.boolean().optional(),
    overrideState: z.nativeEnum(OverrideState),
    startAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional().nullable(),
    reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
  })
  .refine(
    (data) => {
      if (
        !data.applyToAllGroups &&
        (!data.supportGroupIds || data.supportGroupIds.length === 0) &&
        !data.supportGroupId
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Either supportGroupId, supportGroupIds, or applyToAllGroups must be specified",
      path: ["supportGroupId"],
    }
  )
  .refine(
    (data) => {
      if (data.expiresAt) {
        return new Date(data.expiresAt) > new Date(data.startAt);
      }
      return true;
    },
    {
      message: "Expiry time must be after start time",
      path: ["expiresAt"],
    }
  );

export const UpdateSettingsSchema = z.object({
  BMC_PROVIDER_MODE: z.enum(["mock", "helix"]).optional(),
  BMC_BASE_URL: z.string().optional(),
  BMC_USERNAME: z.string().optional(),
  BMC_PASSWORD: z.string().optional(),
  BMC_SYNC_INTERVAL_MINUTES: z.coerce.number().min(1).max(1440).optional(),
  BMC_RETRY_LIMIT: z.coerce.number().min(0).max(10).optional(),
  DEFAULT_TIME_ZONE: z
    .string()
    .refine(isValidIanaTimeZone, "Invalid time zone")
    .optional(),
  MISSING_ROSTER_POLICY: z
    .enum(["TAKE_NO_ACTION", "KEEP_CURRENT_BMC_STATE", "SET_UNAVAILABLE"])
    .optional(),
  ON_CALL_COUNTS_AS_AVAILABLE: z.boolean().optional(),
  SYNC_DRY_RUN: z.boolean().optional(),
});

export const AssignManagerSchema = z.object({
  managerUserId: z.string().min(1, "Manager user required"),
  supportGroupId: z.string().min(1, "Support group required"),
  active: z.boolean().default(true),
});
