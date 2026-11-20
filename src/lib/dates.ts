/**
 * Timezone and date conversion utilities using standard IANA timezone support
 */

export function isValidIanaTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isOvernightShift(startTime: string, endTime: string): boolean {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return endH * 60 + endM < startH * 60 + startM;
}

/**
 * Parses a date string (YYYY-MM-DD) and time string (HH:mm) in a specific timezone
 * and returns the precise JavaScript Date in UTC.
 */
export function parseZonedTime(
  dateStr: string, // YYYY-MM-DD
  timeStr: string, // HH:mm
  timeZone: string
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  // Use Intl to find the exact UTC offset for that local date & time in the specified timezone
  // Create an initial guess in UTC
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  // Determine local parts in target timezone for the guess
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  const getParts = (d: Date) => {
    const parts = formatter.formatToParts(d);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") {
        map[p.type] = parseInt(p.value, 10);
      }
    }
    return map;
  };

  const p1 = getParts(guessUtc);
  const zYear = p1.year;
  const zMonth = p1.month;
  const zDay = p1.day;
  const zHour = p1.hour;
  const zMin = p1.minute;

  // Calculate difference between local target and guess
  const localTargetMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const localCurrentMs = Date.UTC(zYear, zMonth - 1, zDay, zHour, zMin, 0, 0);
  const diffMs = localTargetMs - localCurrentMs;

  const correctedDate = new Date(guessUtc.getTime() + diffMs);

  // Check once more in case of DST jump ambiguity
  const p2 = getParts(correctedDate);
  const diff2 =
    localTargetMs -
    Date.UTC(p2.year, p2.month - 1, p2.day, p2.hour, p2.minute, 0, 0);

  if (diff2 !== 0) {
    return new Date(correctedDate.getTime() + diff2);
  }

  return correctedDate;
}

/**
 * Calculates start and end timestamps in UTC for a shift.
 * Handles overnight shifts (e.g. 22:00 to 06:00) where end time is on the next calendar day.
 */
export function calculateShiftInterval(
  rosterDate: string, // YYYY-MM-DD
  startTime: string,  // HH:mm
  endTime: string,    // HH:mm
  timeZone: string
): { start: Date; end: Date; isOvernight: boolean } {
  const start = parseZonedTime(rosterDate, startTime, timeZone);

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const isOvernight = endMinutes <= startMinutes;

  let end: Date;
  if (isOvernight) {
    // End is on the next day
    const [y, m, d] = rosterDate.split("-").map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
    const nextDateStr = nextDay.toISOString().split("T")[0];
    end = parseZonedTime(nextDateStr, endTime, timeZone);
  } else {
    end = parseZonedTime(rosterDate, endTime, timeZone);
  }

  return { start, end, isOvernight };
}

/**
 * Formats a date to YYYY-MM-DD in a given timezone
 */
export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Returns the week boundaries (Monday to Sunday) for a given date string YYYY-MM-DD
 */
export function getWeekDates(dateStr: string): string[] {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 is Sun, 1 is Mon, etc.
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setUTCDate(monday.getUTCDate() + i);
    dates.push(current.toISOString().split("T")[0]);
  }
  return dates;
}
