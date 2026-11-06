import { CASE_STATUSES, type CaseStatus } from "./case-status";

/**
 * Statuses the application may set automatically. The only one in version 1
 * is quote validation (BR-03, iteration 3).
 */
export const AUTOMATIC_STATUS_TARGETS: readonly CaseStatus[] = ["followup_repairer_report_ok"];

export type StatusChangePlan =
  | { ok: true; from: CaseStatus; to: CaseStatus; automatic: boolean }
  | { ok: false; error: string };

export function isCaseStatus(value: unknown): value is CaseStatus {
  return (CASE_STATUSES as readonly unknown[]).includes(value);
}

/**
 * Status engine (design.md section 2). Users may set any status manually;
 * the application changes it automatically only for BR-03. "Invoicing – OK"
 * needs a complete case (BR-08): `invoicingOkError` is the completeness
 * check's verdict (null when complete).
 */
export function planStatusChange(request: {
  current: CaseStatus;
  target: unknown;
  automatic?: boolean;
  invoicingOkError?: string | null;
}): StatusChangePlan {
  const automatic = request.automatic ?? false;
  if (!isCaseStatus(request.target)) {
    return { ok: false, error: "Choose a valid status." };
  }
  if (request.target === request.current) {
    return { ok: false, error: "The case already has this status." };
  }
  if (automatic && !AUTOMATIC_STATUS_TARGETS.includes(request.target)) {
    return { ok: false, error: "Only quote validation may change the status automatically (BR-03)." };
  }
  if (request.target === "invoicing_ok" && request.invoicingOkError) {
    return { ok: false, error: request.invoicingOkError };
  }
  return { ok: true, from: request.current, to: request.target, automatic };
}
