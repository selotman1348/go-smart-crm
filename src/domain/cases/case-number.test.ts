import { describe, expect, it } from "vitest";

import { CASE_NUMBER_PATTERN, formatCaseNumber, nextCaseNumber, parseCaseNumber } from "./case-number";

describe("nextCaseNumber (BR-01)", () => {
  it("starts at 0001 for the client's first case of the year", () => {
    expect(nextCaseNumber("DEM", 2026, null)).toBe("DEM20260001");
  });

  it("continues after the client's highest number that year", () => {
    expect(nextCaseNumber("VCR", 2026, "VCR20260005")).toBe("VCR20260006");
    expect(nextCaseNumber("VCR", 2026, "VCR20260099")).toBe("VCR20260100");
  });

  it("refuses a last number of another client or year", () => {
    expect(() => nextCaseNumber("VCR", 2026, "VFS20260005")).toThrow();
    expect(() => nextCaseNumber("VCR", 2027, "VCR20260005")).toThrow();
  });

  it("stops after 9999 cases in a year", () => {
    expect(() => nextCaseNumber("VCR", 2026, "VCR20269999")).toThrow(/9999/);
  });
});

describe("formatCaseNumber (BR-01)", () => {
  it("joins client code, 4-digit year and 4-digit sequence", () => {
    expect(formatCaseNumber("ABC", 2025, 115)).toBe("ABC20250115");
    expect(formatCaseNumber("DEM", 2026, 1)).toBe("DEM20260001");
    expect(formatCaseNumber("VELO", 2026, 9999)).toBe("VELO20269999");
  });

  it.each([
    ["client code too short", "AB", 2026, 1],
    ["lower-case client code", "abc", 2026, 1],
    ["2-digit year", "ABC", 26, 1],
    ["sequence 0", "ABC", 2026, 0],
    ["sequence above 9999", "ABC", 2026, 10_000],
    ["fractional sequence", "ABC", 2026, 1.5],
  ])("rejects a %s", (_label, clientCode, year, sequence) => {
    expect(() => formatCaseNumber(clientCode, year, sequence)).toThrow();
  });
});

describe("parseCaseNumber", () => {
  it("splits a case number into its parts", () => {
    expect(parseCaseNumber("ABC20250115")).toEqual({ clientCode: "ABC", year: 2025, sequence: 115 });
    expect(parseCaseNumber("VELO20260002")).toEqual({ clientCode: "VELO", year: 2026, sequence: 2 });
  });

  it.each(["ABC2025011", "AB20250115", "abc20250115", "ABC20250115X"])("rejects %s", (value) => {
    expect(parseCaseNumber(value)).toBeNull();
    expect(CASE_NUMBER_PATTERN.test(value)).toBe(false);
  });
});
