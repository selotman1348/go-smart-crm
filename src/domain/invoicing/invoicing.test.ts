import { describe, expect, it } from "vitest";

import { planStatusChange } from "@/domain/cases/status-engine";

import { checkCompleteness, invoicingOkError, type CompletenessRule } from "./completeness";
import { amountMatches, expectedRepairerAmount, parseRepairerInvoice, planSalesInvoice } from "./invoice-rules";
import type { InvoiceRepository, InvoicingData } from "./invoice-repository";
import { createInvoiceService } from "./invoice-service";

const CLIENT = "22222222-2222-4222-8222-222222222222";
const OTHER_CLIENT = "99999999-9999-4999-8999-999999999999";
const CASE_ID = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_ID = "66666666-6666-4666-8666-666666666666";

const BR08: CompletenessRule[] = [
  { clientAccountId: null, stage: "invoicing", requirement: "quote.estimate" },
  { clientAccountId: null, stage: "invoicing", requirement: "assessment.approval_or_expert_report" },
  { clientAccountId: null, stage: "invoicing", requirement: "invoice.repairer_invoice" },
];
const complete = { hasEstimate: true, hasApprovalOrExpertReport: true, hasRepairerInvoice: true };

describe("completeness check (UC-30, BR-08)", () => {
  it("lists every invoicing requirement with its state", () => {
    const items = checkCompleteness(BR08, {
      clientAccountId: CLIENT,
      stage: "invoicing",
      facts: { ...complete, hasRepairerInvoice: false },
    });
    expect(items.map((item) => [item.requirement, item.met, item.tab])).toEqual([
      ["quote.estimate", true, "quote"],
      ["assessment.approval_or_expert_report", true, "assessment"],
      ["invoice.repairer_invoice", false, "assessment"],
    ]);
    expect(invoicingOkError(items)).toBe(
      "“Invoicing – OK” needs: Repairer invoice (BR-08). Use “Invoicing – other” until then.",
    );
    expect(invoicingOkError(checkCompleteness(BR08, { clientAccountId: CLIENT, stage: "invoicing", facts: complete }))).toBeNull();
  });

  it("applies client rules only to that client and ignores unknown keys", () => {
    const rules: CompletenessRule[] = [
      ...BR08,
      { clientAccountId: OTHER_CLIENT, stage: "invoicing", requirement: "quote.estimate" },
      { clientAccountId: CLIENT, stage: "intake", requirement: "invoice.repairer_invoice" },
      { clientAccountId: null, stage: "invoicing", requirement: "vehicle.colour" },
    ];
    expect(checkCompleteness(rules, { clientAccountId: CLIENT, stage: "invoicing", facts: complete })).toHaveLength(3);
    expect(checkCompleteness(rules, { clientAccountId: CLIENT, stage: "intake", facts: complete }).map((item) => item.requirement)).toEqual([
      "invoice.repairer_invoice",
    ]);
  });

  it("makes the status engine refuse “Invoicing – OK” while something is missing", () => {
    expect(planStatusChange({ current: "invoicing_other", target: "invoicing_ok", invoicingOkError: "needs X" })).toEqual({
      ok: false,
      error: "needs X",
    });
    expect(planStatusChange({ current: "invoicing_other", target: "invoicing_ok", invoicingOkError: null })).toMatchObject({ ok: true });
    // "Invoicing – other" is always possible (BR-08: use it until then).
    expect(planStatusChange({ current: "followup_repairer_report_ok", target: "invoicing_other", invoicingOkError: "needs X" })).toMatchObject({
      ok: true,
    });
  });
});

describe("invoice rules", () => {
  it("expects the approved amount minus the agreed discount (BR-09)", () => {
    expect(expectedRepairerAmount(1000, 13)).toBe(870);
    expect(expectedRepairerAmount(610.3, 13)).toBe(530.96);
    expect(expectedRepairerAmount(610.3, null)).toBe(610.3);
    expect(expectedRepairerAmount(null, 13)).toBeNull();
    expect(amountMatches(530.96, 530.96)).toBe(true);
    expect(amountMatches(531, 530.96)).toBe(false);
    expect(amountMatches(null, 530.96)).toBeNull();
  });

  it("needs a date for a received repairer invoice (UC-29)", () => {
    expect(parseRepairerInvoice({ received: "on", receivedDate: "", amountExclVat: "870,00" })).toEqual({
      ok: false,
      fieldErrors: { receivedDate: ["Enter the date the invoice was received."] },
    });
    expect(parseRepairerInvoice({ received: "on", receivedDate: "2026-11-05", invoiceNumber: "RB-2026-118", amountExclVat: "1.234,50" })).toEqual({
      ok: true,
      value: { received: true, receivedDate: "2026-11-05", invoiceNumber: "RB-2026-118", amountExclVat: 1234.5, documentId: null },
    });
  });

  it("records the sales invoice only once the case is “Invoicing – OK” (UC-31)", () => {
    expect(planSalesInvoice("invoicing_other", { invoiceNumber: "SI-1" })).toEqual({
      ok: false,
      formError: "Set the status to “Invoicing – OK” first (BR-08).",
    });
    expect(planSalesInvoice("invoicing_ok", { invoiceNumber: " " })).toMatchObject({ ok: false, fieldErrors: { invoiceNumber: expect.any(Array) } });
    expect(planSalesInvoice("invoicing_ok", { invoiceNumber: "SI-2026-0042", amountExclVat: "" })).toEqual({
      ok: true,
      value: { invoiceNumber: "SI-2026-0042", amountExclVat: null },
      statusChangeFrom: "invoicing_ok",
    });
  });
});

describe("invoice service", () => {
  function setup(data: Partial<InvoicingData> = {}) {
    const calls = { saved: [] as unknown[], sales: [] as unknown[] };
    const loaded: InvoicingData = {
      caseId: CASE_ID,
      clientAccountId: CLIENT,
      status: "invoicing_other",
      facts: { ...complete, hasRepairerInvoice: false },
      repairerInvoice: null,
      salesInvoice: null,
      approvedExclVat: 1000,
      repairerDiscountPct: 13,
      invoiceDocuments: [{ id: DOCUMENT_ID, fileName: "invoice.pdf" }],
      ...data,
    };
    const repository = {
      rules: async () => BR08,
      load: async (id: string) => (id === CASE_ID ? loaded : null),
      saveRepairerInvoice: async (_id: string, invoice: unknown) => {
        calls.saved.push(invoice);
        return { ok: true as const };
      },
      recordSalesInvoice: async (_id: string, invoice: unknown, expected: string) => {
        calls.sales.push({ invoice, expected });
        return { ok: true as const };
      },
    } as unknown as InvoiceRepository;
    return { service: createInvoiceService(repository), calls };
  }

  it("shows the checklist and the expected amount", async () => {
    const { service } = setup({ repairerInvoice: { received: true, receivedDate: "2026-11-05", invoiceNumber: null, amountExclVat: 900, documentId: null } });
    const overview = await service.overview(CASE_ID);
    expect(overview?.expectedAmount).toBe(870);
    expect(overview?.amountMatches).toBe(false);
    expect(overview?.completeness.filter((item) => !item.met).map((item) => item.label)).toEqual(["Repairer invoice"]);
  });

  it("accepts only an invoice document of the case", async () => {
    const { service, calls } = setup();
    expect(
      await service.saveRepairerInvoice(CASE_ID, { received: "on", receivedDate: "2026-11-05", documentId: "88888888-8888-4888-8888-888888888888" }),
    ).toEqual({ ok: false, fieldErrors: { documentId: ["Choose an invoice document of this case."] } });
    expect(await service.saveRepairerInvoice(CASE_ID, { received: "on", receivedDate: "2026-11-05", documentId: DOCUMENT_ID })).toEqual({ ok: true });
    expect(calls.saved).toHaveLength(1);
  });

  it("closes the case with the sales invoice number", async () => {
    const { service, calls } = setup({ status: "invoicing_ok" });
    expect(await service.recordSalesInvoice(CASE_ID, { invoiceNumber: "SI-2026-0042" })).toEqual({ ok: true });
    expect(calls.sales).toEqual([{ invoice: { invoiceNumber: "SI-2026-0042", amountExclVat: null }, expected: "invoicing_ok" }]);
  });
});
