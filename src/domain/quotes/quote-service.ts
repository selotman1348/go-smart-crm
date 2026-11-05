import type { CaseStatus } from "@/domain/cases/case-status";
import { STATUS_CONFLICT_MESSAGE } from "@/domain/cases/case-service";
import { isUuid, type FieldErrors } from "@/domain/shared/input";
import type { RepositoryError } from "@/domain/shared/repository";

import type { Assessment } from "@/domain/assessment/assessment-repository";

import { parseQuoteInput, type QuoteErrors } from "./quote-input";
import { quoteTotals, type QuoteVersion } from "./quote-lines";
import type { QuoteRepository } from "./quote-repository";
import { canEditQuote, planCopyToPost, planMarkSent } from "./quote-rules";
import { planValidation, type ValidationField } from "./validation";

export const QUOTE_SAVE_FAILED_MESSAGE = "The quote could not be saved. Please try again.";
export const QUOTE_LOCKED_MESSAGE = "This quote is validated and can no longer be changed.";
export const QUOTE_CHANGED_MESSAGE = "The quote was changed in the meantime. Reload the page and try again.";

export type QuoteSaveResult = { ok: true } | { ok: false; errors?: QuoteErrors; formError?: string };
export type ValidateResult =
  | { ok: true }
  | { ok: false; fieldErrors?: FieldErrors<ValidationField>; formError?: string };

type Dependencies = {
  quotes: QuoteRepository;
  caseStatus: (caseId: string) => Promise<CaseStatus | null>;
  assessment: (caseId: string) => Promise<Assessment | null>;
};

function explainSaveError(error: RepositoryError | "not_found"): QuoteSaveResult {
  if (error !== "not_found" && error.code === "PT409") {
    return { ok: false, formError: QUOTE_LOCKED_MESSAGE };
  }
  if (error !== "not_found" && error.code === "23514") {
    return { ok: false, formError: QUOTE_CHANGED_MESSAGE };
  }
  return { ok: false, formError: QUOTE_SAVE_FAILED_MESSAGE };
}

export function createQuoteService({ quotes, caseStatus, assessment }: Dependencies) {
  return {
    getForCase(caseId: string) {
      return isUuid(caseId) ? quotes.getForCase(caseId) : Promise.resolve({ pre: null, post: null });
    },

    /** UC-18: saves the pre- or post-calculation with its lines. */
    async save(caseId: string, version: QuoteVersion, input: unknown): Promise<QuoteSaveResult> {
      if (!isUuid(caseId)) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const parsed = parseQuoteInput(input);
      if (!parsed.ok) {
        return { ok: false, errors: parsed.errors };
      }
      const current = await quotes.getForCase(caseId);
      const stored = version === "pre_calculation" ? current.pre : current.post;
      if (!canEditQuote(stored)) {
        return { ok: false, formError: QUOTE_LOCKED_MESSAGE };
      }
      const known = new Set(stored?.lines.map((line) => line.id));
      if (parsed.value.lines.some((line) => line.id && !known.has(line.id))) {
        return { ok: false, formError: QUOTE_CHANGED_MESSAGE };
      }
      const result = await quotes.save(caseId, version, parsed.value);
      return result.ok ? { ok: true } : explainSaveError(result.error);
    },

    /** UC-21: copies all pre-calculation lines to the post-calculation. */
    async copyToPost(caseId: string): Promise<QuoteSaveResult> {
      if (!isUuid(caseId)) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const { pre, post } = await quotes.getForCase(caseId);
      const plan = planCopyToPost(pre, post);
      if (!plan.ok) {
        return { ok: false, formError: plan.error };
      }
      const lines = pre!.lines.map(({ category, subType, description, amount }) => ({
        id: null,
        category,
        subType,
        description,
        amount,
      }));
      const result = await quotes.save(
        caseId,
        "post_calculation",
        {
          origin: plan.origin === "ai" ? "manual" : plan.origin,
          hourlyRatePaint: pre!.hourlyRatePaint,
          hourlyRateAssembly: pre!.hourlyRateAssembly,
          lines,
          total: quoteTotals(lines).total,
        },
        plan.copiedFromQuoteId,
      );
      return result.ok ? { ok: true } : explainSaveError(result.error);
    },

    /** UC-20: records that the estimate was sent to the broker. */
    async markSent(caseId: string): Promise<QuoteSaveResult> {
      const { pre } = isUuid(caseId) ? await quotes.getForCase(caseId) : { pre: null };
      const plan = planMarkSent(pre);
      if (!plan.ok) {
        return { ok: false, formError: plan.error };
      }
      return (await quotes.markSent(plan.quoteId)) ? { ok: true } : { ok: false, formError: QUOTE_CHANGED_MESSAGE };
    },

    /** UC-22: validates the post-calculation; the status changes automatically (BR-03). */
    async validate(caseId: string, input: unknown): Promise<ValidateResult> {
      if (!isUuid(caseId)) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const [{ post }, status, stored] = await Promise.all([
        quotes.getForCase(caseId),
        caseStatus(caseId),
        assessment(caseId),
      ]);
      if (!status) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const plan = planValidation({
        post,
        hasExpertReport: Boolean(stored?.expertReportDocumentId),
        currentStatus: status,
        input,
      });
      if (!plan.ok) {
        return plan;
      }
      const result = await quotes.validate(plan, stored?.expertAccountId ?? null);
      if (!result.ok) {
        return {
          ok: false,
          formError: result.error.code === "PT409" ? STATUS_CONFLICT_MESSAGE : "The quote could not be validated. Please try again.",
        };
      }
      return { ok: true };
    },
  };
}

export type QuoteService = ReturnType<typeof createQuoteService>;
