import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";

import type { CaseStatus } from "@/domain/cases/case-status";
import { planStatusChange } from "@/domain/cases/status-engine";
import { checkbox, fieldErrorsOf, optionalInteger, type FieldErrors } from "@/domain/shared/input";
import { fromCents, moneyField, toCents } from "@/domain/shared/money";

import type { Quote } from "./quote-rules";

export type AssessmentType = Database["public"]["Enums"]["assessment_type"];

export const ASSESSMENT_TYPES = [
  "none",
  "on_site",
  "smart_expertise",
  "approval_without_expert",
] as const satisfies readonly AssessmentType[];

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  none: "None",
  on_site: "On site",
  smart_expertise: "Smart Expertise",
  approval_without_expert: "Approval without expert",
};

/** Belgian standard VAT rate (agreed 2026-11-05). */
export const VAT_RATE = 0.21;

/** The approved status after validation (BR-03). */
export const VALIDATED_STATUS: CaseStatus = "followup_repairer_report_ok";

/** Approved amount incl. VAT: excl. × 1.21 when VAT applies, otherwise the same amount. */
export function amountInclVat(amountExclVat: number, vatApplicable: boolean): number {
  return vatApplicable ? fromCents(Math.round(toCents(amountExclVat) * (1 + VAT_RATE))) : amountExclVat;
}

/** BR-04: a remote assessment is Smart Expertise, otherwise On site. */
export function expertAssessmentType(remote: boolean): AssessmentType {
  return remote ? "smart_expertise" : "on_site";
}

const validationInputSchema = z.object({
  assessmentType: z.enum(ASSESSMENT_TYPES, { error: "Choose the assessment type." }),
  vatApplicable: checkbox,
  approvedAmountExclVat: moneyField({ required: true, message: "Enter the approved amount." }),
  // BR-05: the repair duration stated by the expert.
  lossOfUseDays: optionalInteger({ min: 0, max: 365 }),
  remoteAssessment: checkbox,
  reportMatchesCase: checkbox,
});

export type ValidationField = keyof z.output<typeof validationInputSchema>;

export type ValidationPlan = {
  quoteId: string;
  assessmentType: AssessmentType;
  vatApplicable: boolean;
  approvedAmountExclVat: number;
  approvedAmountInclVat: number;
  lossOfUseDays: number | null;
  /** The status to change from automatically (BR-03), or null when the case already has it. */
  statusChangeFrom: CaseStatus | null;
};

/**
 * UC-22: checks the Validate dialog against the post-calculation and the
 * expert rules, and plans the automatic status change (BR-03).
 */
export function planValidation(context: {
  post: Quote | null;
  hasExpertReport: boolean;
  currentStatus: CaseStatus;
  input: unknown;
}):
  | ({ ok: true } & ValidationPlan)
  | { ok: false; fieldErrors?: FieldErrors<ValidationField>; formError?: string } {
  const { post } = context;
  if (!post || post.lines.length === 0) {
    return { ok: false, formError: "Enter the post-calculation first, for example by copying the pre-calculation." };
  }
  if (post.status === "validated") {
    return { ok: false, formError: "The post-calculation is already validated." };
  }

  const parsed = validationInputSchema.safeParse(context.input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf<ValidationField>(parsed.error) };
  }
  const input = parsed.data;

  if (context.hasExpertReport) {
    // BR-04, and BR-06: the report must belong to this case's damage.
    const expected = expertAssessmentType(input.remoteAssessment);
    if (input.assessmentType !== expected) {
      return {
        ok: false,
        fieldErrors: {
          assessmentType: [
            `With an expert report the type is ${expected === "smart_expertise" ? "Smart Expertise (remote assessment)" : "On site"} (BR-04).`,
          ],
        },
      };
    }
    if (!input.reportMatchesCase) {
      return {
        ok: false,
        fieldErrors: { reportMatchesCase: ["Confirm that the expert report matches this case's damage (BR-06)."] },
      };
    }
  }

  let statusChangeFrom: CaseStatus | null = null;
  if (context.currentStatus !== VALIDATED_STATUS) {
    const plan = planStatusChange({ current: context.currentStatus, target: VALIDATED_STATUS, automatic: true });
    if (!plan.ok) {
      return { ok: false, formError: plan.error };
    }
    statusChangeFrom = plan.from;
  }

  const approvedAmountExclVat = input.approvedAmountExclVat!;
  return {
    ok: true,
    quoteId: post.id,
    assessmentType: input.assessmentType,
    vatApplicable: input.vatApplicable,
    approvedAmountExclVat,
    approvedAmountInclVat: amountInclVat(approvedAmountExclVat, input.vatApplicable),
    lossOfUseDays: input.lossOfUseDays,
    statusChangeFrom,
  };
}
