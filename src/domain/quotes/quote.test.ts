import { describe, expect, it } from "vitest";

import { parseQuoteInput } from "./quote-input";
import { quoteTotals } from "./quote-lines";
import { canEditQuote, planCopyToPost, planMarkSent, type Quote } from "./quote-rules";

const LINE_ID = "11111111-1111-4111-8111-111111111111";

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-pre",
    version: "pre_calculation",
    origin: "repairer",
    status: "draft",
    hourlyRatePaint: 62,
    hourlyRateAssembly: 58,
    total: 100,
    copiedFromQuoteId: null,
    lines: [{ id: LINE_ID, category: "parts", subType: null, description: "Bumper", amount: 100 }],
    ...overrides,
  };
}

describe("quoteTotals (UC-18)", () => {
  it("adds subtotals per category, in category order, and the total", () => {
    expect(
      quoteTotals([
        { category: "parts", amount: 412.3 },
        { category: "labour", amount: 145 },
        { category: "labour", amount: 248 },
        { category: "other_costs", amount: 12.5 },
        { category: "deduction", amount: -150 },
      ]),
    ).toEqual({
      subtotals: [
        { category: "labour", amount: 393 },
        { category: "parts", amount: 412.3 },
        { category: "other_costs", amount: 12.5 },
        { category: "deduction", amount: -150 },
      ],
      total: 667.8,
    });
  });

  it("calculates in cents, without floating-point noise", () => {
    expect(quoteTotals([{ category: "parts", amount: 0.1 }, { category: "parts", amount: 0.2 }]).total).toBe(0.3);
    expect(quoteTotals([]).total).toBe(0);
  });
});

describe("parseQuoteInput", () => {
  const input = (lines: unknown[], extra: object = {}) => ({ origin: "repairer", lines, ...extra });

  it("accepts lines with typed amounts and adds the total", () => {
    const result = parseQuoteInput(
      input(
        [
          { category: "labour", subType: "paintwork", description: " Paint bumper ", amount: "248,00" },
          { category: "parts", subType: "", description: "Bumper", amount: "1.234,56" },
        ],
        { hourlyRatePaint: "62", hourlyRateAssembly: "" },
      ),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        origin: "repairer",
        hourlyRatePaint: 62,
        hourlyRateAssembly: null,
        lines: [
          { id: null, category: "labour", subType: "paintwork", description: "Paint bumper", amount: 248 },
          { id: null, category: "parts", subType: null, description: "Bumper", amount: 1234.56 },
        ],
        total: 1482.56,
      },
    });
  });

  it("requires a sub-type for labour, other costs and deductions (Q-010)", () => {
    const result = parseQuoteInput(
      input([
        { category: "labour", amount: "10" },
        { category: "other_costs", amount: "10" },
        { category: "deduction", amount: "10" },
      ]),
    );
    expect(!result.ok && result.errors).toEqual({
      "lines.0.subType": ["Choose a sub-type."],
      "lines.1.subType": ["Choose a sub-type."],
      "lines.2.subType": ["Choose a sub-type."],
    });
  });

  it("only allows the sub-types of the line's category", () => {
    const result = parseQuoteInput(
      input([
        { category: "labour", subType: "wear_and_tear", amount: "10" },
        { category: "parts", subType: "paintwork", amount: "10" },
      ]),
    );
    expect(!result.ok && Object.keys(result.errors)).toEqual(["lines.0.subType", "lines.1.subType"]);
  });

  it("stores deductions as negative amounts and rejects negative amounts elsewhere", () => {
    const result = parseQuoteInput(input([{ category: "deduction", subType: "previous_claim", amount: "150" }]));
    expect(result.ok && result.value.lines[0].amount).toBe(-150);
    expect(result.ok && result.value.total).toBe(-150);

    const negative = parseQuoteInput(input([{ category: "parts", amount: "-20" }]));
    expect(!negative.ok && negative.errors["lines.0.amount"]).toEqual([
      "Enter a positive amount; use a deduction line to subtract.",
    ]);
  });

  it("rejects missing or invalid amounts, categories and origins", () => {
    const result = parseQuoteInput({
      origin: "ai",
      lines: [{ category: "parts", amount: "" }, { category: "transport", amount: "5" }, { category: "parts", amount: "12.3456" }],
    });
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
      "lines.0.amount",
      "lines.1.category",
      "lines.2.amount",
      "origin",
    ]);
  });
});

describe("quote rules", () => {
  it("locks a validated quote", () => {
    expect(canEditQuote(null)).toBe(true);
    expect(canEditQuote(quote({ status: "sent" }))).toBe(true);
    expect(canEditQuote(quote({ status: "validated" }))).toBe(false);
  });

  it("copies the pre-calculation over a draft post-calculation (UC-21)", () => {
    const pre = quote();
    expect(planCopyToPost(pre, null)).toEqual({ ok: true, origin: "repairer", replaces: 0, copiedFromQuoteId: "q-pre" });
    expect(planCopyToPost(pre, quote({ id: "q-post", version: "post_calculation" }))).toMatchObject({ ok: true, replaces: 1 });
  });

  it("does not copy without pre-calculation lines or over a validated post-calculation", () => {
    expect(planCopyToPost(null, null).ok).toBe(false);
    expect(planCopyToPost(quote({ lines: [] }), null).ok).toBe(false);
    expect(planCopyToPost(quote(), quote({ version: "post_calculation", status: "validated" }))).toEqual({
      ok: false,
      error: "The post-calculation is validated and cannot be replaced.",
    });
  });

  it("marks a saved draft estimate as sent, once (UC-20)", () => {
    expect(planMarkSent(quote())).toEqual({ ok: true, quoteId: "q-pre" });
    expect(planMarkSent(quote({ status: "sent" })).ok).toBe(false);
    expect(planMarkSent(quote({ lines: [] })).ok).toBe(false);
    expect(planMarkSent(null).ok).toBe(false);
  });
});
