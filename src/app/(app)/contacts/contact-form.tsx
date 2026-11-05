"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { AccountOption } from "@/domain/accounts/account-repository";
import type { Contact } from "@/domain/contacts/contact-repository";

import { initialFormState, type FormValues } from "../form-state";
import type { ContactFormState } from "./actions";

type Values = {
  accountId: string;
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

function fromContact(contact: Contact | undefined, accountId: string | undefined): Values {
  return {
    accountId: contact?.accountId ?? accountId ?? "",
    salutation: contact?.salutation ?? "",
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
  };
}

function fromSubmitted(values: FormValues): Values {
  const text = (key: keyof Values) => {
    const value = values[key];
    return typeof value === "string" ? value : "";
  };
  return {
    accountId: text("accountId"),
    salutation: text("salutation"),
    firstName: text("firstName"),
    lastName: text("lastName"),
    email: text("email"),
    phone: text("phone"),
  };
}

type Action = (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;

export function ContactForm({
  action,
  contact,
  accountId,
  accountOptions,
}: {
  action: Action;
  contact?: Contact;
  /** Preselected account for a new contact. */
  accountId?: string;
  accountOptions: AccountOption[];
}) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(
    action,
    initialFormState,
  );
  const defaults = state.values ? fromSubmitted(state.values) : fromContact(contact, accountId);
  const errors = state.fieldErrors ?? {};
  const backHref = contact ? "/contacts" : accountId ? `/accounts/${accountId}` : "/contacts";

  return (
    <form action={formAction} className="grid gap-6">
      {state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}
      {state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>Check the highlighted fields.</AlertDescription>
        </Alert>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Changes saved.
        </p>
      ) : null}

      <div key={state.version} className="grid gap-4 sm:grid-cols-2">
        <FormField id="accountId" label="Account" error={errors.accountId} className="sm:col-span-2">
          {(control) => (
            <NativeSelect
              {...control}
              name="accountId"
              required
              defaultValue={defaults.accountId}
              className="w-full"
            >
              <NativeSelectOption value="">Choose an account…</NativeSelectOption>
              {accountOptions.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id="salutation" label="Salutation" error={errors.salutation}>
          {(control) => (
            <Input {...control} name="salutation" placeholder="Mr, Ms…" defaultValue={defaults.salutation} />
          )}
        </FormField>
        <div className="hidden sm:block" />
        <FormField id="firstName" label="First name" error={errors.firstName}>
          {(control) => <Input {...control} name="firstName" defaultValue={defaults.firstName} />}
        </FormField>
        <FormField id="lastName" label="Last name" error={errors.lastName}>
          {(control) => (
            <Input {...control} name="lastName" required defaultValue={defaults.lastName} />
          )}
        </FormField>
        <FormField id="email" label="E-mail" error={errors.email}>
          {(control) => <Input {...control} name="email" type="email" defaultValue={defaults.email} />}
        </FormField>
        <FormField id="phone" label="Phone" error={errors.phone}>
          {(control) => <Input {...control} name="phone" type="tel" defaultValue={defaults.phone} />}
        </FormField>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : contact ? "Save changes" : "Create contact"}
        </Button>
        <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
          {contact ? "Back to contacts" : "Cancel"}
        </Link>
      </div>
    </form>
  );
}
