import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  isoToZonedLocal,
  nextDate,
  zonedDate,
  zonedDayStartIso,
  zonedLocalToIso,
  zonedYear,
} from "./time";

describe("zoned calendar date and year (Europe/Brussels)", () => {
  it("uses the Brussels date, not the UTC date", () => {
    // 23:30 UTC on 31 December is already 1 January in Brussels.
    const instant = new Date("2026-12-31T23:30:00Z");
    expect(zonedDate(instant)).toBe("2027-01-01");
    expect(zonedYear(instant)).toBe(2027);
    expect(zonedYear(new Date("2026-12-31T22:30:00Z"))).toBe(2026);
  });
});

describe("zonedLocalToIso", () => {
  it("converts winter time (UTC+1)", () => {
    expect(zonedLocalToIso("2026-11-06T14:00")).toBe("2026-11-06T13:00:00.000Z");
  });

  it("converts summer time (UTC+2)", () => {
    expect(zonedLocalToIso("2026-07-01T08:30")).toBe("2026-07-01T06:30:00.000Z");
  });

  it("moves a time skipped by the spring DST change forward", () => {
    // 2026-03-29 02:30 does not exist in Brussels; 03:30 CEST = 01:30 UTC.
    expect(zonedLocalToIso("2026-03-29T02:30")).toBe("2026-03-29T01:30:00.000Z");
  });

  it("round-trips through isoToZonedLocal", () => {
    for (const local of ["2026-01-15T09:05", "2026-03-29T03:00", "2026-10-25T03:30", "2026-12-31T23:59"]) {
      expect(isoToZonedLocal(zonedLocalToIso(local))).toBe(local);
    }
  });

  it("rejects values that are not a valid date and time", () => {
    for (const value of ["", "2026-11-06", "2026-02-30T10:00", "2026-11-06T24:00", "06/11/2026 14:00"]) {
      expect(zonedLocalToIso(value)).toBeNull();
    }
  });
});

describe("day boundaries and formatting", () => {
  it("gives the instant a Brussels day starts", () => {
    expect(zonedDayStartIso("2026-11-05")).toBe("2026-11-04T23:00:00.000Z");
    expect(zonedDayStartIso("2026-07-01")).toBe("2026-06-30T22:00:00.000Z");
  });

  it("steps to the next date across month and year ends", () => {
    expect(nextDate("2026-02-28")).toBe("2026-03-01");
    expect(nextDate("2026-12-31")).toBe("2027-01-01");
  });

  it("formats dates as dd/mm/yyyy and times in Brussels", () => {
    expect(formatDate("2026-11-05")).toBe("05/11/2026");
    expect(formatDate(null)).toBe("");
    expect(formatDateTime("2026-11-06T13:00:00Z")).toBe("06/11/2026 14:00");
    expect(isoToZonedLocal(null)).toBe("");
  });
});
