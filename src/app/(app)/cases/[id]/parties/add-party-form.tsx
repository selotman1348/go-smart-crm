"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { FormMessages } from "@/components/form-actions";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { TypedAccountOption } from "@/domain/accounts/account-repository";
import type { PartyField } from "@/domain/parties/party-input";
import type { ContactOption } from "@/domain/parties/party-repository";
import { PARTY_ROLE_ORDER, PARTY_ROLES, type PartyRole } from "@/domain/parties/party-roles";

import { initialFormState, type FormState } from "../../../form-state";

type Action = (state: FormState<PartyField>, formData: FormData) => Promise<FormState<PartyField>>;

/** UC-11: per role, pick an account or a contact. */
export function AddPartyForm({
  action,
  accounts,
  contacts,
}: {
  action: Action;
  accounts: TypedAccountOption[];
  contacts: ContactOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState<PartyField>, FormData>(action, initialFormState);
  const [role, setRole] = useState<PartyRole>("driver");
  const [accountId, setAccountId] = useState("");
  const definition = PARTY_ROLES[role];
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  const roleAccounts = accounts.filter((account) =>
    definition.accountTypes.some((type) => account.accountTypes.includes(type)),
  );
  const roleContacts =
    definition.kind === "person" ? contacts : contacts.filter((contact) => contact.accountId === accountId);

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Add party</h2>
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="role" label="Role" error={state.fieldErrors?.role}>
          {(control) => (
            <NativeSelect
              {...control}
              name="role"
              value={role}
              onChange={(event) => {
                setRole(event.target.value as PartyRole);
                setAccountId("");
              }}
              className="w-full"
            >
              {PARTY_ROLE_ORDER.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {PARTY_ROLES[value].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>

        {definition.kind === "organisation" ? (
          <FormField id="accountId" label="Account" error={state.fieldErrors?.accountId}>
            {(control) => (
              <NativeSelect
                {...control}
                name="accountId"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="w-full"
              >
                <NativeSelectOption value="">Choose an account…</NativeSelectOption>
                {roleAccounts.map((account) => (
                  <NativeSelectOption key={account.id} value={account.id}>
                    {account.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        ) : null}

        <FormField
          id="contactId"
          label={definition.kind === "person" ? "Person" : "Contact person (optional)"}
          error={state.fieldErrors?.contactId}
        >
          {(control) => (
            <NativeSelect
              // Before the spread: a key after a spread makes JSX fall back to createElement.
              key={`${role}-${accountId}`}
              {...control}
              name="contactId"
              defaultValue=""
              disabled={definition.kind === "organisation" && !accountId}
              className="w-full"
            >
              <NativeSelectOption value="">
                {definition.kind === "person" ? "Choose a person…" : "None"}
              </NativeSelectOption>
              {roleContacts.map((contact) => (
                <NativeSelectOption key={contact.id} value={contact.id}>
                  {definition.kind === "person"
                    ? `${contact.name} (${accountNames.get(contact.accountId) ?? ""})`
                    : contact.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add party"}
        </Button>
      </div>
    </form>
  );
}
