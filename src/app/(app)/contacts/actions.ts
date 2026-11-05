"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { getContactService, type ContactField } from "@/domain/contacts";

import { readForm, type FormState } from "../form-state";
import { requireUser } from "../session";

export type ContactFormState = FormState<ContactField>;

/** Creates a contact (contactId null) or saves changes to it. */
export async function saveContactAction(
  contactId: string | null,
  previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  await requireUser();
  const values = readForm(formData);
  const contacts = await getContactService();
  const result = await contacts.save(values, contactId ?? undefined);
  const version = previous.version + 1;

  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version };
  }
  if (!contactId) {
    redirect(`/contacts/${result.id}`);
  }
  refresh();
  return { saved: true, version };
}
