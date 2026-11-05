import type { CaseStatus } from "@/domain/cases/case-status";
import { STATUS_CONFLICT_MESSAGE } from "@/domain/cases/case-service";
import { isUuid, optionalUuid, type FieldErrors } from "@/domain/shared/input";
import type { RepositoryError } from "@/domain/shared/repository";

import type { AssessmentRepository } from "./assessment-repository";
import { planNoRepair, planTotalLoss } from "./repair-decision";

export type DecisionResult = { ok: true } | { ok: false; fieldErrors?: FieldErrors<string>; formError?: string };

export const DECISION_FAILED_MESSAGE = "The decision could not be recorded. Please try again.";
const CASE_NOT_FOUND = "This case no longer exists.";

function explain(result: { ok: true } | { ok: false; error: RepositoryError }): DecisionResult {
  if (result.ok) {
    return result;
  }
  return {
    ok: false,
    formError: result.error.code === "PT409" ? STATUS_CONFLICT_MESSAGE : DECISION_FAILED_MESSAGE,
  };
}

export function createAssessmentService(
  repository: AssessmentRepository,
  caseStatus: (caseId: string) => Promise<CaseStatus | null>,
) {
  const statusOf = (caseId: string) => (isUuid(caseId) ? caseStatus(caseId) : Promise.resolve(null));

  return {
    async get(caseId: string) {
      if (!isUuid(caseId)) {
        return null;
      }
      const [assessment, context] = await Promise.all([
        repository.getForCase(caseId),
        repository.expertContext(caseId),
      ]);
      return { assessment, ...context };
    },

    /** UC-24: the expert, and which uploaded document is the expert report. */
    async saveExpert(
      caseId: string,
      input: { expertAccountId?: unknown; expertReportDocumentId?: unknown },
    ): Promise<DecisionResult> {
      const expertAccountId = optionalUuid.safeParse(input.expertAccountId);
      const expertReportDocumentId = optionalUuid.safeParse(input.expertReportDocumentId);
      if (!isUuid(caseId) || !expertAccountId.success || !expertReportDocumentId.success) {
        return { ok: false, formError: "Choose a valid expert and report." };
      }
      const context = await repository.expertContext(caseId);
      if (expertAccountId.data && !context.experts.some((expert) => expert.id === expertAccountId.data)) {
        return { ok: false, fieldErrors: { expertAccountId: ["Add the expert to the case's parties first (UC-23)."] } };
      }
      if (
        expertReportDocumentId.data &&
        !context.expertReports.some((report) => report.id === expertReportDocumentId.data)
      ) {
        return { ok: false, fieldErrors: { expertReportDocumentId: ["Choose one of this case's expert reports."] } };
      }
      const result = await repository.saveExpert(caseId, {
        expertAccountId: expertAccountId.data,
        expertReportDocumentId: expertReportDocumentId.data,
      });
      return result.ok ? result : { ok: false, formError: DECISION_FAILED_MESSAGE };
    },

    /** UC-27 / BR-07: no repair, with a reason and a notified repairer; closes the case. */
    async recordNoRepair(caseId: string, input: unknown): Promise<DecisionResult> {
      const status = await statusOf(caseId);
      if (!status) {
        return { ok: false, formError: CASE_NOT_FOUND };
      }
      const plan = planNoRepair(status, input);
      if (!plan.ok) {
        return plan;
      }
      return explain(
        await repository.recordDecision(caseId, { kind: "no_repair", values: plan.values }, plan.statusChangeFrom),
      );
    },

    /** UC-26: the total-loss figures; closes the case. */
    async recordTotalLoss(caseId: string, input: unknown): Promise<DecisionResult> {
      const status = await statusOf(caseId);
      if (!status) {
        return { ok: false, formError: CASE_NOT_FOUND };
      }
      const plan = planTotalLoss(status, input);
      if (!plan.ok) {
        return plan;
      }
      return explain(
        await repository.recordDecision(caseId, { kind: "total_loss", values: plan.values }, plan.statusChangeFrom),
      );
    },
  };
}

export type AssessmentService = ReturnType<typeof createAssessmentService>;
