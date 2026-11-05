import { z } from "zod";

import type { CaseStatus } from "@/domain/cases/case-status";
import { planStatusChange } from "@/domain/cases/status-engine";
import { checkbox, fieldErrorsOf, optionalCode, optionalText, type FieldErrors } from "@/domain/shared/input";
import { fromCents, moneyField, toCents } from "@/domain/shared/money";

export type RepairDecisionPlan<Values> =
  | { ok: true; values: Values; statusChangeFrom: CaseStatus }
  | { ok: false; fieldErrors?: FieldErrors<string>; formError?: string };

/** Both decisions close the case: a manual change by the user, through the status engine. */
function planClose(currentStatus: CaseStatus): { ok: true; from: CaseStatus } | { ok: false; error: string } {
  if (currentStatus === "closed") {
    return { ok: false, error: "The case is already closed." };
  }
  const plan = planStatusChange({ current: currentStatus, target: "closed" });
  return plan.ok ? { ok: true, from: plan.from } : { ok: false, error: plan.error };
}

const noRepairSchema = z.object({
  reason: optionalCode.refine((code) => code !== null, { error: "Choose why the repair is cancelled (BR-07)." }),
  reasonText: optionalText(500),
  // BR-07: the repairer is notified immediately. Until e-mail sending arrives
  // (iteration 4) the user confirms it.
  repairerNotified: checkbox.refine((notified) => notified, {
    error: "Confirm that the repairer was told not to start the repair (BR-07).",
  }),
});

export type NoRepairField = keyof z.output<typeof noRepairSchema>;
export type NoRepairValues = { reason: string; reasonText: string | null };

/** UC-27 / BR-07: no repair needs a reason and a notified repairer, and closes the case. */
export function planNoRepair(currentStatus: CaseStatus, input: unknown): RepairDecisionPlan<NoRepairValues> {
  const parsed = noRepairSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf<NoRepairField>(parsed.error) };
  }
  const close = planClose(currentStatus);
  if (!close.ok) {
    return { ok: false, formError: close.error };
  }
  return {
    ok: true,
    values: { reason: parsed.data.reason!, reasonText: parsed.data.reasonText },
    statusChangeFrom: close.from,
  };
}

/**
 * UC-26: the damage amount of a total loss, proposed as vehicle value − deduction
 * for previous damage + accessories − wreck value (never below 0).
 */
export function proposedTotalLossAmount(figures: {
  vehicleValue: number;
  previousDamageDeduction: number | null;
  accessories: number | null;
  wreckValue: number | null;
}): number {
  const cents =
    toCents(figures.vehicleValue) -
    toCents(figures.previousDamageDeduction ?? 0) +
    toCents(figures.accessories ?? 0) -
    toCents(figures.wreckValue ?? 0);
  return fromCents(Math.max(0, cents));
}

const totalLossSchema = z.object({
  vehicleValue: moneyField({ required: true, message: "Enter the vehicle value before the incident." }),
  previousDamageDeduction: moneyField({ required: false }),
  accessories: moneyField({ required: false }),
  wreckValue: moneyField({ required: false }),
  // Empty: use the proposed amount; otherwise the amount from the expert report.
  damageAmount: moneyField({ required: false }),
});

export type TotalLossField = keyof z.output<typeof totalLossSchema>;
export type TotalLossValues = {
  vehicleValue: number;
  previousDamageDeduction: number | null;
  accessories: number | null;
  wreckValue: number | null;
  damageAmount: number;
};

/** UC-26: records the total-loss figures and closes the case. */
export function planTotalLoss(currentStatus: CaseStatus, input: unknown): RepairDecisionPlan<TotalLossValues> {
  const parsed = totalLossSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf<TotalLossField>(parsed.error) };
  }
  const close = planClose(currentStatus);
  if (!close.ok) {
    return { ok: false, formError: close.error };
  }
  const figures = { ...parsed.data, vehicleValue: parsed.data.vehicleValue! };
  return {
    ok: true,
    values: { ...figures, damageAmount: figures.damageAmount ?? proposedTotalLossAmount(figures) },
    statusChangeFrom: close.from,
  };
}
