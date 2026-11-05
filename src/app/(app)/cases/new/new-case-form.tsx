"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { AccountOption } from "@/domain/accounts/account-repository";

import { initialFormState } from "../../form-state";
import { createCaseAction, type NewCaseFormState } from "../actions";

export function NewCaseForm({ clients }: { clients: AccountOption[] }) {
  const [state, formAction, pending] = useActionState<NewCaseFormState, FormData>(
    createCaseAction,
    initialFormState,
  );
  const selected = typeof state.values?.clientAccountId === "string" ? state.values.clientAccountId : "";

  return (
    <form action={formAction} className="grid gap-6">
      {state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}
      <FormField
        id="clientAccountId"
        label="Client"
        error={state.fieldErrors?.clientAccountId}
        hint="The case number is generated from the client code, the year and the next sequence number (BR-01)."
      >
        {(control) => (
          <NativeSelect
            key={state.version}
            {...control}
            name="clientAccountId"
            required
            defaultValue={selected}
            className="w-full"
          >
            <NativeSelectOption value="">Choose a client…</NativeSelectOption>
            {clients.map((client) => (
              <NativeSelectOption key={client.id} value={client.id}>
                {client.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create case"}
        </Button>
        <Link href="/cases" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
