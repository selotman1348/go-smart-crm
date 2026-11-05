"use server";

import { refresh } from "next/cache";

import type { QuoteErrors } from "@/domain/quotes/quote-input";
import type { QuoteVersion } from "@/domain/quotes/quote-lines";
import type { ValidationField } from "@/domain/quotes/validation";
import { getQuoteService } from "@/domain/quotes";

import type { ActionResult } from "../../../documents/actions";
import { readForm, type FormState, type FormValues } from "../../../form-state";
import { requireUser } from "../../../session";

export type QuoteFormState = {
  errors?: QuoteErrors;
  formError?: string;
  saved?: boolean;
  /** The submitted quote, so a rejected save keeps what the user typed. */
  submitted?: unknown;
  version: number;
};

/** UC-18: saves the pre- or post-calculation. The editor posts its state as JSON. */
export async function saveQuoteAction(
  caseId: string,
  quoteVersion: QuoteVersion,
  previous: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  await requireUser();
  let submitted: unknown;
  try {
    submitted = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { formError: "The quote could not be read. Please try again.", version: previous.version + 1 };
  }
  const quotes = await getQuoteService();
  const result = await quotes.save(caseId, quoteVersion, submitted);
  if (!result.ok) {
    return { errors: result.errors, formError: result.formError, submitted, version: previous.version + 1 };
  }
  refresh();
  return { saved: true, version: previous.version + 1 };
}

/** UC-21: copies the pre-calculation to the post-calculation. */
export async function copyToPostAction(caseId: string): Promise<ActionResult> {
  await requireUser();
  const quotes = await getQuoteService();
  const result = await quotes.copyToPost(caseId);
  if (!result.ok) {
    return { ok: false, error: result.formError ?? "The pre-calculation could not be copied." };
  }
  refresh();
  return { ok: true };
}

/** UC-20: records that the estimate went to the broker (e-mail follows in iteration 4). */
export async function markSentAction(caseId: string): Promise<ActionResult> {
  await requireUser();
  const quotes = await getQuoteService();
  const result = await quotes.markSent(caseId);
  if (!result.ok) {
    return { ok: false, error: result.formError ?? "The estimate could not be marked as sent." };
  }
  refresh();
  return { ok: true };
}

export type ValidateFormState = FormState<ValidationField>;

/** UC-22: validates the post-calculation; the status changes automatically (BR-03). */
export async function validateQuoteAction(
  caseId: string,
  previous: ValidateFormState,
  formData: FormData,
): Promise<ValidateFormState> {
  await requireUser();
  const values: FormValues = readForm(formData);
  const quotes = await getQuoteService();
  const result = await quotes.validate(caseId, values);
  const version = previous.version + 1;
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version };
  }
  refresh();
  return { saved: true, version };
}
