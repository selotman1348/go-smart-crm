"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { getIntakeService } from "@/domain/intake";

import { readForm, type FormState } from "../form-state";
import { requireUser } from "../session";

export type LinkFormState = FormState<"caseNumber">;

/** "Upload .eml", step 1: a one-time upload URL. */
export async function prepareEmlUploadAction(input: { fileName: string; size: number }) {
  await requireUser();
  const intake = await getIntakeService();
  return intake.prepareEmlUpload(input);
}

/** "Upload .eml", step 2: the uploaded e-mail goes through the intake pipeline. */
export async function processEmlAction(emailId: string) {
  await requireUser();
  const intake = await getIntakeService();
  return intake.processUploadedEml(emailId);
}

/** "Link to case": the e-mail is logged on the case with its attachments. */
export async function linkEmailAction(emailId: string, previous: LinkFormState, formData: FormData): Promise<LinkFormState> {
  await requireUser();
  const values = readForm(formData);
  const intake = await getIntakeService();
  const result = await intake.link(emailId, values.caseNumber);
  if (!result.ok) {
    return { fieldErrors: { caseNumber: [result.error] }, values, version: previous.version + 1 };
  }
  refresh();
  return { saved: true, version: previous.version + 1 };
}

/** "Create case from e-mail": opens the new-case form with the e-mail beside it. */
export async function createCaseFromEmailAction(emailId: string): Promise<void> {
  await requireUser();
  const intake = await getIntakeService();
  const result = await intake.prepareConversion(emailId);
  redirect(result.ok ? `/cases/new?email=${emailId}` : `/inbox/${emailId}`);
}
