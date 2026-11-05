"use server";

import { refresh } from "next/cache";

import { getAssessmentService } from "@/domain/assessment";
import type { DecisionResult } from "@/domain/assessment/assessment-service";

import { readForm, type FormState, type FormValues } from "../../../form-state";
import { requireUser } from "../../../session";

export type AssessmentFormState = FormState<string>;

function afterSave(result: DecisionResult, values: FormValues, previous: AssessmentFormState): AssessmentFormState {
  const version = previous.version + 1;
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version };
  }
  refresh();
  return { saved: true, version };
}

/** UC-23/24: the expert and the expert report. */
export async function saveExpertAction(
  caseId: string,
  previous: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  await requireUser();
  const values = readForm(formData);
  const assessments = await getAssessmentService();
  return afterSave(await assessments.saveExpert(caseId, values), values, previous);
}

/** UC-26: records the total loss and closes the case. */
export async function recordTotalLossAction(
  caseId: string,
  previous: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  await requireUser();
  const values = readForm(formData);
  const assessments = await getAssessmentService();
  return afterSave(await assessments.recordTotalLoss(caseId, values), values, previous);
}

/** UC-27 / BR-07: records no repair and closes the case. */
export async function recordNoRepairAction(
  caseId: string,
  previous: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  await requireUser();
  const values = readForm(formData);
  const assessments = await getAssessmentService();
  return afterSave(await assessments.recordNoRepair(caseId, values), values, previous);
}
