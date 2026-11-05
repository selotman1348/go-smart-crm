"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { getAccountService, type AccountField } from "@/domain/accounts";

import { readForm, type FormState } from "../form-state";
import { requireUser } from "../session";

export type AccountFormState = FormState<AccountField>;

/** Creates an account (accountId null) or saves changes to it. */
export async function saveAccountAction(
  accountId: string | null,
  previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  await requireUser();
  const values = readForm(formData, ["accountTypes"]);
  const accounts = await getAccountService();
  const result = await accounts.save(values, accountId ?? undefined);
  const version = previous.version + 1;

  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version };
  }
  if (!accountId) {
    redirect(`/accounts/${result.id}`);
  }
  refresh();
  return { saved: true, version };
}
