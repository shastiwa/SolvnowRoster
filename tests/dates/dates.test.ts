import { describe, it, expect } from "vitest";
import {
  calculateShiftInterval,
  isValidIanaTimeZone,
  isOvernightShift,
  getWeekDates,
} from "@/lib/dates";

describe("Date and Timezone Utilities", () => {
  it("validates IANA timezones correctly", () => {
    expect(isValidIanaTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidIanaTimeZone("UTC")).toBe(true);
    expect(isValidIanaTimeZone("America/New_York")).toBe(true);
    expect(isValidIanaTimeZone("Invalid/Timezone_X")).toBe(false);
  });

  it("identifies overnight shifts", () => {
    expect(isOvernightShift("09:00", "17:00")).toBe(false);
    expect(isOvernightShift("16:00", "00:30")).toBe(true);
    expect(isOvernightShift("23:00", "07:00")).toBe(true);
    expect(isOvernightShift("08:00", "08:00")).toBe(false);
  });

  it("calculates regular daytime shift interval correctly", () => {
    const { start, end } = calculateShiftInterval(
      "2026-03-10",
      "09:00",
      "17:00",
      "Asia/Kolkata"
    );

    // 09:00 IST = 03:30 UTC
    // 17:00 IST = 11:30 UTC
    expect(start.toISOString()).toBe("2026-03-10T03:30:00.000Z");
    expect(end.toISOString()).toBe("2026-03-10T11:30:00.000Z");
  });

  it("calculates overnight shift interval spanning into next calendar day", () => {
    const { start, end } = calculateShiftInterval(
      "2026-03-10",
      "22:00",
      "06:00",
      "Asia/Kolkata"
    );

    // 22:00 IST = 16:30 UTC on 2026-03-10
    // 06:00 IST next day = 00:30 UTC on 2026-03-11
    expect(start.toISOString()).toBe("2026-03-10T16:30:00.000Z");
    expect(end.toISOString()).toBe("2026-03-11T00:30:00.000Z");
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it("generates 7 consecutive week dates starting Monday", () => {
    const week = getWeekDates("2026-03-11"); // Wednesday
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-03-09"); // Monday
    expect(week[6]).toBe("2026-03-15"); // Sunday
  });
});
