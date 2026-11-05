import { describe, expect, it } from "vitest";

import { formatMoney, moneyField, parseMoney, roundMoney } from "./money";

describe("parseMoney", () => {
  it.each([
    ["1234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["€ 1 234,56", 1234.56],
    ["12,5", 12.5],
    ["248", 248],
    ["1.234.567", 1234567],
    // Money has at most two decimals, so three digits after one separator are thousands.
    ["18.500", 18500],
    ["12,345", 12345],
    ["-150", -150],
    [248.5, 248.5],
  ])("reads %s as %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it("returns null for an empty value", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("  ")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });

  it.each(["abc", "12.3456", "1,2,3.4.5", "12.345,678", "1.2.3,45x", "1.23.456", "12,34,567.8"])(
    "rejects the invalid value %s",
    (input) => {
      expect(parseMoney(input)).toBeNaN();
    },
  );
});

describe("money helpers", () => {
  it("rounds to cents without floating-point noise", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1563.1385)).toBe(1563.14);
  });

  it("formats euros", () => {
    expect(formatMoney(1234.56)).toBe("€1,234.56");
    expect(formatMoney(-150)).toBe("-€150.00");
    expect(formatMoney(null)).toBe("");
  });

  it("validates an amount field", () => {
    const required = moneyField({ required: true, message: "Enter the value." });
    expect(required.safeParse("1.234,50").data).toBe(1234.5);
    expect(required.safeParse("").error?.issues[0].message).toBe("Enter the value.");
    expect(required.safeParse("-5").success).toBe(false);
    expect(moneyField({ required: false }).safeParse("").data).toBeNull();
  });
});
