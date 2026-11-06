import type { Database } from "@/lib/supabase/database.types";

import type { CaseStatus } from "@/domain/cases/case-status";
import type { CaseTab } from "@/domain/cases/case-warnings";

export type CompletenessStage = Database["public"]["Enums"]["completeness_stage"];

/** What the completeness rules are checked against. */
export type CompletenessFacts = {
  /** A pre-calculation with lines, or an estimate document. */
  hasEstimate: boolean;
  /** A validated assessment (approval), or an expert report document. */
  hasApprovalOrExpertReport: boolean;
  /** The repairer invoice is marked as received. */
  hasRepairerInvoice: boolean;
};

type Requirement = {
  label: string;
  /** The tab where the user completes it (warning marker, BR-13). */
  tab: CaseTab;
  met: (facts: CompletenessFacts) => boolean;
};

/**
 * The requirement keys a completeness_rule row may use. Unknown keys are
 * ignored, so a rule added in the database before the code knows it does no
 * harm.
 */
export const REQUIREMENTS: Record<string, Requirement> = {
  "quote.estimate": {
    label: "Estimate (pre-calculation or estimate document)",
    tab: "quote",
    met: (facts) => facts.hasEstimate,
  },
  "assessment.approval_or_expert_report": {
    label: "Approval or expert report",
    tab: "assessment",
    met: (facts) => facts.hasApprovalOrExpertReport,
  },
  "invoice.repairer_invoice": {
    label: "Repairer invoice",
    tab: "assessment",
    met: (facts) => facts.hasRepairerInvoice,
  },
};

export type CompletenessRule = { clientAccountId: string | null; stage: CompletenessStage; requirement: string };

export type CompletenessItem = { requirement: string; label: string; tab: CaseTab; met: boolean };

/** The rules of one stage that apply to the client (global rules and the client's own), checked. */
export function checkCompleteness(
  rules: CompletenessRule[],
  input: { clientAccountId: string; stage: CompletenessStage; facts: CompletenessFacts },
): CompletenessItem[] {
  const seen = new Set<string>();
  const items: CompletenessItem[] = [];
  for (const rule of rules) {
    const requirement = REQUIREMENTS[rule.requirement];
    const applies = rule.stage === input.stage && (rule.clientAccountId === null || rule.clientAccountId === input.clientAccountId);
    if (!requirement || !applies || seen.has(rule.requirement)) {
      continue;
    }
    seen.add(rule.requirement);
    items.push({ requirement: rule.requirement, label: requirement.label, tab: requirement.tab, met: requirement.met(input.facts) });
  }
  return items;
}

export const INVOICING_STATUSES: readonly CaseStatus[] = ["invoicing_other", "invoicing_ok"];

/**
 * BR-08: "Invoicing – OK" only when every invoicing requirement is met;
 * returns the error for the status engine, or null.
 */
export function invoicingOkError(items: CompletenessItem[]): string | null {
  const missing = items.filter((item) => !item.met).map((item) => item.label);
  return missing.length === 0
    ? null
    : `“Invoicing – OK” needs: ${missing.join(", ")} (BR-08). Use “Invoicing – other” until then.`;
}
