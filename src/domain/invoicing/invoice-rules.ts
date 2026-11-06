import { z } from "zod";

import type { CaseStatus } from "@/domain/cases/case-status";
import { checkbox, fieldErrorsOf, optionalDate, optionalText, optionalUuid, requiredText, type FieldErrors } from "@/domain/shared/input";
import { fromCents, moneyField, toCents } from "@/domain/shared/money";

/**
 * BR-09: the repairer invoices the approved amount minus the agreed total
 * discount (e.g. 13%). Null when there is no approved amount yet.
 */
export function expectedRepairerAmount(approvedExclVat: number | null, discountPct: number | null): number | null {
  if (approvedExclVat === null) {
    return null;
  }
  return fromCents(Math.round(toCents(approvedExclVat) * (1 - (discountPct ?? 0) / 100)));
}

/** Whether an invoiced amount matches the expected one, to the cent. */
export function amountMatches(amount: number | null, expected: number | null): boolean | null {
  if (amount === null || expected === null) {
    return null;
  }
  return toCents(amount) === toCents(expected);
}

// UC-29: the repairer invoice
const repairerInvoiceSchema = z
  .object({
    received: checkbox,
    receivedDate: optionalDate,
    invoiceNumber: optionalText(100),
    amountExclVat: moneyField({ required: false, max: 10_000_000 }),
    documentId: optionalUuid,
  })
  .superRefine((value, context) => {
    if (value.received && !value.receivedDate) {
      context.addIssue({ code: "custom", path: ["receivedDate"], message: "Enter the date the invoice was received." });
    }
  });

export type RepairerInvoiceInput = z.output<typeof repairerInvoiceSchema>;
export type RepairerInvoiceField = keyof RepairerInvoiceInput;

export function parseRepairerInvoice(
  input: unknown,
): { ok: true; value: RepairerInvoiceInput } | { ok: false; fieldErrors: FieldErrors<RepairerInvoiceField> } {
  const parsed = repairerInvoiceSchema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
}

// UC-31: the sales invoice number from accounting
const salesInvoiceSchema = z.object({
  invoiceNumber: requiredText("Enter the sales invoice number.", 100),
  amountExclVat: moneyField({ required: false, max: 10_000_000 }),
});

export type SalesInvoiceInput = z.output<typeof salesInvoiceSchema>;
export type SalesInvoiceField = keyof SalesInvoiceInput;

/**
 * UC-31: the sales invoice number closes the case, once it is "Invoicing –
 * OK" (design.md section 2).
 */
export function planSalesInvoice(
  status: CaseStatus,
  input: unknown,
):
  | { ok: true; value: SalesInvoiceInput; statusChangeFrom: CaseStatus }
  | { ok: false; fieldErrors?: FieldErrors<SalesInvoiceField>; formError?: string } {
  if (status !== "invoicing_ok") {
    return { ok: false, formError: "Set the status to “Invoicing – OK” first (BR-08)." };
  }
  const parsed = salesInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  return { ok: true, value: parsed.data, statusChangeFrom: status };
}
