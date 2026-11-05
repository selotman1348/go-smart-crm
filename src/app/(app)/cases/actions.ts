"use server";

import { redirect } from "next/navigation";

import { getCaseService } from "@/domain/cases";

import { readForm, type FormState } from "../form-state";
import { requireUser } from "../session";

export type NewCaseFormState = FormState<"clientAccountId">;

/** UC-08: creates a case for the chosen client and opens it. */
export async function createCaseAction(previous: NewCaseFormState, formData: FormData): Promise<NewCaseFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const cases = await getCaseService();
  const result = await cases.create({ clientAccountId: values.clientAccountId }, user.id);
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version: previous.version + 1 };
  }
  redirect(`/cases/${result.id}`);
}
