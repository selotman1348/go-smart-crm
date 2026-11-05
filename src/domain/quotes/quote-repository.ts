import type { DbClient } from "@/lib/supabase/server";

import type { CaseStatus } from "@/domain/cases/case-status";
import type { RepositoryError, WriteResult } from "@/domain/shared/repository";

import type { QuoteInput } from "./quote-input";
import type { QuoteVersion } from "./quote-lines";
import type { Quote } from "./quote-rules";
import type { ValidationPlan } from "./validation";

export type CaseQuotes = { pre: Quote | null; post: Quote | null };

export function createQuoteRepository(db: DbClient) {
  return {
    async getForCase(caseId: string): Promise<CaseQuotes> {
      const { data, error } = await db
        .from("quote")
        .select(
          `id, version, origin, status, hourly_rate_paint, hourly_rate_assembly, total_excl_vat, copied_from_quote_id,
           quote_line (id, category, sub_type, description, amount, created_at)`,
        )
        .eq("case_id", caseId)
        .order("created_at", { referencedTable: "quote_line" })
        .order("id", { referencedTable: "quote_line" });
      if (error) {
        throw new Error(`Could not load the quotes: ${error.message}`);
      }
      const quotes = data.map(
        (row): Quote => ({
          id: row.id,
          version: row.version,
          origin: row.origin,
          status: row.status,
          hourlyRatePaint: row.hourly_rate_paint,
          hourlyRateAssembly: row.hourly_rate_assembly,
          total: row.total_excl_vat,
          copiedFromQuoteId: row.copied_from_quote_id,
          lines: row.quote_line.map((line) => ({
            id: line.id,
            category: line.category,
            subType: line.sub_type,
            description: line.description,
            amount: line.amount,
          })),
        }),
      );
      return {
        pre: quotes.find((quote) => quote.version === "pre_calculation") ?? null,
        post: quotes.find((quote) => quote.version === "post_calculation") ?? null,
      };
    },

    /** Saves the quote with its lines in one transaction (save_quote). */
    async save(
      caseId: string,
      version: QuoteVersion,
      quote: QuoteInput,
      copiedFromQuoteId: string | null = null,
    ): Promise<WriteResult> {
      const { data, error } = await db.rpc("save_quote", {
        p_case_id: caseId,
        p_version: version,
        p_origin: quote.origin,
        p_hourly_rate_paint: quote.hourlyRatePaint as number,
        p_hourly_rate_assembly: quote.hourlyRateAssembly as number,
        p_lines: quote.lines.map((line) => ({
          id: line.id,
          category: line.category,
          sub_type: line.subType,
          description: line.description,
          amount: line.amount,
        })),
        p_total: quote.total,
        p_copied_from_quote_id: copiedFromQuoteId ?? undefined,
      });
      return error ? { ok: false, error } : { ok: true, id: data };
    },

    async markSent(quoteId: string): Promise<boolean> {
      const { data, error } = await db
        .from("quote")
        .update({ status: "sent" })
        .eq("id", quoteId)
        .eq("status", "draft")
        .select("id");
      if (error) {
        throw new Error(`Could not mark the quote as sent: ${error.message}`);
      }
      return data.length > 0;
    },

    /** Validates the post-calculation and applies BR-03 in one transaction (validate_quote). */
    async validate(
      plan: ValidationPlan,
      expertAccountId: string | null,
    ): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.rpc("validate_quote", {
        p_quote_id: plan.quoteId,
        p_assessment_type: plan.assessmentType,
        p_expert_account_id: expertAccountId as string,
        p_vat_applicable: plan.vatApplicable,
        p_approved_amount_excl_vat: plan.approvedAmountExclVat,
        p_approved_amount_incl_vat: plan.approvedAmountInclVat,
        p_loss_of_use_days: plan.lossOfUseDays as number,
        // null: the case already has the validated status, so no change (BR-03).
        p_expected_status: plan.statusChangeFrom as CaseStatus,
      });
      return error ? { ok: false, error } : { ok: true };
    },
  };
}

export type QuoteRepository = ReturnType<typeof createQuoteRepository>;
