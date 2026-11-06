"use server";

import { redirect } from "next/navigation";

import { getCaseService } from "@/domain/cases";
import { getIntakeService } from "@/domain/intake";

import { readForm, type FormState } from "../form-state";
import { requireUser } from "../session";

export type NewCaseFormState = FormState<"clientAccountId">;

/**
 * UC-08: creates a case for the chosen client and opens it. From "Create
 * case from e-mail", the e-mail is then logged on the new case.
 */
export async function createCaseAction(previous: NewCaseFormState, formData: FormData): Promise<NewCaseFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const cases = await getCaseService();
  const result = await cases.create({ clientAccountId: values.clientAccountId }, user.id);
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version: previous.version + 1 };
  }
  if (typeof values.emailId === "string" && values.emailId !== "") {
    const intake = await getIntakeService();
    // If this fails (someone else handled the e-mail), the case still exists
    // and the e-mail stays where it is.
    await intake.convert(values.emailId, result.id);
  }
  redirect(`/cases/${result.id}`);
}
