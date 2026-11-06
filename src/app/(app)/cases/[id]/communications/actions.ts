"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { getCommunicationService } from "@/domain/communications";

import { readForm, type FormState } from "../../../form-state";
import { requireUser } from "../../../session";

export type CommunicationFormState = FormState<string>;

/** UC-35: "Add communication" – a phone call or other contact. */
export async function logContactAction(
  caseId: string,
  previous: CommunicationFormState,
  formData: FormData,
): Promise<CommunicationFormState> {
  await requireUser();
  const values = readForm(formData);
  const communications = await getCommunicationService();
  const result = await communications.logContact(caseId, values);
  const version = previous.version + 1;
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version };
  }
  refresh();
  return { saved: true, version };
}

/** UC-35: marks a communication as processed, or not. */
export async function setProcessedAction(caseId: string, communicationId: string, processed: boolean): Promise<void> {
  await requireUser();
  const communications = await getCommunicationService();
  await communications.setProcessed(caseId, communicationId, processed);
  refresh();
}

/** UC-33, step 1: renders the template as a draft and opens it. */
export async function createDraftAction(
  caseId: string,
  previous: CommunicationFormState,
  formData: FormData,
): Promise<CommunicationFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const communications = await getCommunicationService();
  const result = await communications.createDraft(caseId, values, user);
  if (!result.ok) {
    return { formError: result.formError, values, version: previous.version + 1 };
  }
  redirect(`/cases/${caseId}/communications/messages/${result.id}`);
}

/**
 * A template e-mail started from another tab, e.g. "Send assessment order"
 * (UC-23); `audience` (a party role) overrides the template's addressee.
 */
export async function startTemplateEmailAction(caseId: string, templateCode: string, audience: string | null): Promise<void> {
  const user = await requireUser();
  const communications = await getCommunicationService();
  const result = await communications.createDraft(caseId, { templateCode, language: "en", audience: audience ?? undefined }, user);
  redirect(result.ok ? `/cases/${caseId}/communications/messages/${result.id}` : `/cases/${caseId}/communications`);
}

/** UC-33, step 2: saves the draft, or sends it when the user clicked Send. */
export async function composeAction(
  caseId: string,
  messageId: string,
  previous: CommunicationFormState,
  formData: FormData,
): Promise<CommunicationFormState> {
  const user = await requireUser();
  const values = readForm(formData, ["documentIds"]);
  const communications = await getCommunicationService();
  const sending = values.intent === "send";
  const result = sending
    ? await communications.send(caseId, messageId, values, user)
    : await communications.saveDraft(caseId, messageId, values);
  const version = previous.version + 1;
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version };
  }
  if (sending) {
    redirect(`/cases/${caseId}/communications?sent=1`);
  }
  refresh();
  return { saved: true, values, version };
}

export async function discardDraftAction(caseId: string, messageId: string): Promise<void> {
  await requireUser();
  const communications = await getCommunicationService();
  await communications.discard(caseId, messageId);
  redirect(`/cases/${caseId}/communications`);
}
