import { STATUS_CONFLICT_MESSAGE } from "@/domain/cases/case-service";
import { isUuid, type FieldErrors } from "@/domain/shared/input";

import { checkCompleteness, type CompletenessItem, type CompletenessStage } from "./completeness";
import { amountMatches, expectedRepairerAmount, parseRepairerInvoice, planSalesInvoice } from "./invoice-rules";
import type { InvoiceRepository } from "./invoice-repository";

const SAVE_FAILED = "The invoice could not be saved. Please try again.";

export type InvoiceResult = { ok: true } | { ok: false; fieldErrors?: FieldErrors<string>; formError?: string };

/** Invoicing and closure (UC-29 to UC-31) and the completeness check (UC-30, BR-08, BR-13). */
export function createInvoiceService(repository: InvoiceRepository) {
  async function completeness(caseId: string, stage: CompletenessStage): Promise<CompletenessItem[]> {
    const data = isUuid(caseId) ? await repository.load(caseId) : null;
    if (!data) {
      return [];
    }
    return checkCompleteness(await repository.rules(), { clientAccountId: data.clientAccountId, stage, facts: data.facts });
  }

  return {
    completeness,

    /** The Assessment tab's invoicing section. */
    async overview(caseId: string) {
      const data = isUuid(caseId) ? await repository.load(caseId) : null;
      if (!data) {
        return null;
      }
      const items = checkCompleteness(await repository.rules(), {
        clientAccountId: data.clientAccountId,
        stage: "invoicing",
        facts: data.facts,
      });
      const expected = expectedRepairerAmount(data.approvedExclVat, data.repairerDiscountPct);
      return {
        ...data,
        completeness: items,
        expectedAmount: expected,
        amountMatches: amountMatches(data.repairerInvoice?.amountExclVat ?? null, expected),
      };
    },

    /** UC-29: invoice received, date, number, amount and the uploaded invoice. */
    async saveRepairerInvoice(caseId: string, input: unknown): Promise<InvoiceResult> {
      const data = isUuid(caseId) ? await repository.load(caseId) : null;
      if (!data) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const parsed = parseRepairerInvoice(input);
      if (!parsed.ok) {
        return parsed;
      }
      const { documentId } = parsed.value;
      if (documentId && !data.invoiceDocuments.some((document) => document.id === documentId)) {
        return { ok: false, fieldErrors: { documentId: ["Choose an invoice document of this case."] } };
      }
      const result = await repository.saveRepairerInvoice(caseId, parsed.value);
      return result.ok ? result : { ok: false, formError: SAVE_FAILED };
    },

    /** UC-31: the sales invoice number closes the case. */
    async recordSalesInvoice(caseId: string, input: unknown): Promise<InvoiceResult> {
      const data = isUuid(caseId) ? await repository.load(caseId) : null;
      if (!data) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const plan = planSalesInvoice(data.status, input);
      if (!plan.ok) {
        return plan;
      }
      const result = await repository.recordSalesInvoice(caseId, plan.value, plan.statusChangeFrom);
      if (!result.ok) {
        return { ok: false, formError: result.error.code === "PT409" ? STATUS_CONFLICT_MESSAGE : SAVE_FAILED };
      }
      return { ok: true };
    },
  };
}

export type InvoiceService = ReturnType<typeof createInvoiceService>;
