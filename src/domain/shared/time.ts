/**
 * Dates and times in the company's time zone. Calendar dates are stored as
 * YYYY-MM-DD; moments (appointments, creation times) as UTC instants.
 */
export const APP_TIME_ZONE = "Europe/Brussels";

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** The calendar date (YYYY-MM-DD) of an instant in the time zone. */
export function zonedDate(instant: Date = new Date(), timeZone = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function zonedYear(instant: Date = new Date(), timeZone = APP_TIME_ZONE): number {
  return Number(zonedDate(instant, timeZone).slice(0, 4));
}

function wallClockParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/** UTC offset of the time zone at an instant, in milliseconds. */
function offsetAt(instantMs: number, timeZone: string): number {
  const wall = wallClockParts(new Date(instantMs), timeZone);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Converts a wall-clock time in the time zone ("2026-11-06T14:00", the value
 * of an <input type="datetime-local">) to an ISO instant. Returns null for an
 * invalid value. A time skipped by the spring DST change moves forward an hour.
 */
export function zonedLocalToIso(local: string, timeZone = APP_TIME_ZONE): string | null {
  const match = LOCAL_DATE_TIME.exec(local);
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wallAsUtc);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) {
    return null;
  }
  const firstGuess = wallAsUtc - offsetAt(wallAsUtc, timeZone);
  const instant = wallAsUtc - offsetAt(firstGuess, timeZone);
  return new Date(instant).toISOString();
}

/** An ISO instant as a wall-clock value for <input type="datetime-local">. */
export function isoToZonedLocal(iso: string | null, timeZone = APP_TIME_ZONE): string {
  if (!iso) {
    return "";
  }
  const wall = wallClockParts(new Date(iso), timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** The instant a calendar day starts in the time zone, e.g. for "created on or after". */
export function zonedDayStartIso(date: string, timeZone = APP_TIME_ZONE): string | null {
  return zonedLocalToIso(`${date}T00:00`, timeZone);
}

/** The calendar date after `date` (YYYY-MM-DD). */
export function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** "2026-11-05" -> "05/11/2026". */
export function formatDate(date: string | null | undefined): string {
  if (!date) {
    return "";
  }
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** An ISO instant as "05/11/2026 14:30" in the time zone. */
export function formatDateTime(iso: string | null | undefined, timeZone = APP_TIME_ZONE): string {
  if (!iso) {
    return "";
  }
  const [date, time] = isoToZonedLocal(iso, timeZone).split("T");
  return `${formatDate(date)} ${time}`;
}
