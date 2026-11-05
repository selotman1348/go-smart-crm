import { describe, expect, it, vi } from "vitest";

import type { Assessment } from "@/domain/assessment/assessment-repository";

import type { QuoteRepository } from "./quote-repository";
import type { Quote } from "./quote-rules";
import { createQuoteService, QUOTE_CHANGED_MESSAGE, QUOTE_LOCKED_MESSAGE } from "./quote-service";

const CASE = "33333333-3333-4333-8333-333333333333";
const LINE = "11111111-1111-4111-8111-111111111111";

const pre: Quote = {
  id: "q-pre",
  version: "pre_calculation",
  origin: "repairer",
  status: "sent",
  hourlyRatePaint: 62,
  hourlyRateAssembly: 58,
  total: 360.5,
  copiedFromQuoteId: null,
  lines: [
    { id: LINE, category: "labour", subType: "paintwork", description: "Paint", amount: 248 },
    { id: "l2", category: "parts", subType: null, description: "Clip", amount: 112.5 },
  ],
};

function setup(overrides: { quotes?: Partial<QuoteRepository>; assessment?: Partial<Assessment> | null } = {}) {
  const quotes: QuoteRepository = {
    getForCase: vi.fn(async () => ({ pre, post: null })),
    save: vi.fn(async () => ({ ok: true as const, id: "q" })),
    markSent: vi.fn(async () => true),
    validate: vi.fn(async () => ({ ok: true as const })),
    ...overrides.quotes,
  };
  const service = createQuoteService({
    quotes,
    caseStatus: async () => "followup_broker_insurer",
    assessment: async () => (overrides.assessment === undefined ? null : (overrides.assessment as Assessment)),
  });
  return { quotes, service };
}

describe("quote service", () => {
  it("saves a quote with its total", async () => {
    const { quotes, service } = setup();
    await expect(
      service.save(CASE, "pre_calculation", {
        origin: "repairer",
        lines: [{ id: LINE, category: "labour", subType: "paintwork", amount: "300" }],
      }),
    ).resolves.toEqual({ ok: true });
    expect(quotes.save).toHaveBeenCalledWith(CASE, "pre_calculation", expect.objectContaining({ total: 300 }));
  });

  it("refuses to change a validated quote", async () => {
    const { quotes, service } = setup({
      quotes: { getForCase: vi.fn(async () => ({ pre: { ...pre, status: "validated" as const }, post: null })) },
    });
    await expect(service.save(CASE, "pre_calculation", { origin: "manual", lines: [] })).resolves.toEqual({
      ok: false,
      formError: QUOTE_LOCKED_MESSAGE,
    });
    expect(quotes.save).not.toHaveBeenCalled();
  });

  it("refuses line ids that are not on the stored quote", async () => {
    const { service } = setup();
    await expect(
      service.save(CASE, "pre_calculation", {
        origin: "manual",
        lines: [{ id: "99999999-9999-4999-8999-999999999999", category: "parts", amount: "1" }],
      }),
    ).resolves.toEqual({ ok: false, formError: QUOTE_CHANGED_MESSAGE });
  });

  it("copies all pre-calculation lines to a new post-calculation (UC-21)", async () => {
    const { quotes, service } = setup();
    await expect(service.copyToPost(CASE)).resolves.toEqual({ ok: true });
    expect(quotes.save).toHaveBeenCalledWith(
      CASE,
      "post_calculation",
      {
        origin: "repairer",
        hourlyRatePaint: 62,
        hourlyRateAssembly: 58,
        lines: [
          { id: null, category: "labour", subType: "paintwork", description: "Paint", amount: 248 },
          { id: null, category: "parts", subType: null, description: "Clip", amount: 112.5 },
        ],
        total: 360.5,
      },
      "q-pre",
    );
  });

  it("validates the post-calculation with the stored expert", async () => {
    const post = { ...pre, id: "q-post", version: "post_calculation" as const, status: "draft" as const };
    const { quotes, service } = setup({
      quotes: { getForCase: vi.fn(async () => ({ pre, post })) },
      assessment: { expertAccountId: "expert-1", expertReportDocumentId: null },
    });
    await expect(
      service.validate(CASE, { assessmentType: "approval_without_expert", approvedAmountExclVat: "360,50" }),
    ).resolves.toEqual({ ok: true });
    expect(quotes.validate).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: "q-post", approvedAmountInclVat: 360.5, statusChangeFrom: "followup_broker_insurer" }),
      "expert-1",
    );
  });

  it("applies BR-04 when an expert report is stored", async () => {
    const post = { ...pre, id: "q-post", version: "post_calculation" as const, status: "draft" as const };
    const { quotes, service } = setup({
      quotes: { getForCase: vi.fn(async () => ({ pre, post })) },
      assessment: { expertAccountId: "expert-1", expertReportDocumentId: "doc-1" },
    });
    const result = await service.validate(CASE, {
      assessmentType: "approval_without_expert",
      approvedAmountExclVat: "360,50",
      reportMatchesCase: "on",
    });
    expect(result.ok).toBe(false);
    expect(quotes.validate).not.toHaveBeenCalled();
  });
});
