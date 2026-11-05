"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { CheckboxField, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Account, AccountOption } from "@/domain/accounts/account-repository";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "@/domain/accounts/account-types";

import { initialFormState, type FormValues } from "../form-state";
import type { AccountFormState } from "./actions";

type Values = {
  name: string;
  accountTypes: string[];
  clientCode: string;
  parentAccountId: string;
  vatNumber: string;
  vatLiable: boolean;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  invoicingConditions: string;
  discountPct: string;
  requiresVdaPo: boolean;
  isNetworkMember: boolean;
};

function fromAccount(account?: Account): Values {
  return {
    name: account?.name ?? "",
    accountTypes: account?.accountTypes ?? [],
    clientCode: account?.clientCode ?? "",
    parentAccountId: account?.parentAccountId ?? "",
    vatNumber: account?.vatNumber ?? "",
    vatLiable: account?.vatLiable ?? false,
    addressLine1: account?.addressLine1 ?? "",
    addressLine2: account?.addressLine2 ?? "",
    postcode: account?.postcode ?? "",
    city: account?.city ?? "",
    country: account?.country ?? "",
    phone: account?.phone ?? "",
    email: account?.email ?? "",
    invoicingConditions: account?.invoicingConditions ?? "",
    discountPct: account?.discountPct?.toString() ?? "",
    requiresVdaPo: account?.requiresVdaPo ?? false,
    isNetworkMember: account?.isNetworkMember ?? false,
  };
}

function fromSubmitted(values: FormValues): Values {
  const text = (key: string) => {
    const value = values[key];
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    accountTypes: Array.isArray(values.accountTypes) ? values.accountTypes : [],
    clientCode: text("clientCode"),
    parentAccountId: text("parentAccountId"),
    vatNumber: text("vatNumber"),
    vatLiable: values.vatLiable === "on",
    addressLine1: text("addressLine1"),
    addressLine2: text("addressLine2"),
    postcode: text("postcode"),
    city: text("city"),
    country: text("country"),
    phone: text("phone"),
    email: text("email"),
    invoicingConditions: text("invoicingConditions"),
    discountPct: text("discountPct"),
    requiresVdaPo: values.requiresVdaPo === "on",
    isNetworkMember: values.isNetworkMember === "on",
  };
}

type Action = (state: AccountFormState, formData: FormData) => Promise<AccountFormState>;

export function AccountForm({
  action,
  account,
  parentOptions,
}: {
  action: Action;
  account?: Account;
  parentOptions: AccountOption[];
}) {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    action,
    initialFormState,
  );
  const defaults = state.values ? fromSubmitted(state.values) : fromAccount(account);

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

      <AccountFields
        key={state.version}
        defaults={defaults}
        errors={state.fieldErrors ?? {}}
        parentOptions={parentOptions.filter((option) => option.id !== account?.id)}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : account ? "Save changes" : "Create account"}
        </Button>
        <Link href="/accounts" className={buttonVariants({ variant: "outline" })}>
          {account ? "Back to accounts" : "Cancel"}
        </Link>
      </div>
    </form>
  );
}

function AccountFields({
  defaults,
  errors,
  parentOptions,
}: {
  defaults: Values;
  errors: NonNullable<AccountFormState["fieldErrors"]>;
  parentOptions: AccountOption[];
}) {
  // Controlled, so the client and repairer settings can follow the chosen types.
  const [types, setTypes] = useState(defaults.accountTypes);
  const isClient = types.includes("client");
  const isRepairer = types.includes("repairer");

  return (
    <>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-medium">General</legend>
        <FormField id="name" label="Name" error={errors.name} className="sm:col-span-2">
          {(control) => (
            <Input {...control} name="name" required defaultValue={defaults.name} />
          )}
        </FormField>

        <div className="grid gap-2 sm:col-span-2" role="group" aria-labelledby="account-types-label">
          <p id="account-types-label" className="text-sm font-medium">
            Account types
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ACCOUNT_TYPES.map((type) => (
              <CheckboxField
                key={type}
                name="accountTypes"
                value={type}
                label={ACCOUNT_TYPE_LABELS[type]}
                checked={types.includes(type)}
                onCheckedChange={(checked) =>
                  setTypes((current) =>
                    checked ? [...current, type] : current.filter((item) => item !== type),
                  )
                }
              />
            ))}
          </div>
          {errors.accountTypes?.[0] ? (
            <p className="text-sm text-destructive">{errors.accountTypes[0]}</p>
          ) : null}
        </div>

        <FormField
          id="parentAccountId"
          label="Parent account"
          error={errors.parentAccountId}
          hint="For groups of companies (BR-02)."
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="parentAccountId"
              defaultValue={defaults.parentAccountId}
              className="w-full"
            >
              <NativeSelectOption value="">None</NativeSelectOption>
              {parentOptions.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField id="vatNumber" label="VAT number" error={errors.vatNumber}>
          {(control) => <Input {...control} name="vatNumber" defaultValue={defaults.vatNumber} />}
        </FormField>

        <div className="sm:col-span-2">
          <CheckboxField name="vatLiable" label="VAT liable" defaultChecked={defaults.vatLiable} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-medium">Address and contact details</legend>
        <FormField id="addressLine1" label="Address line 1" error={errors.addressLine1}>
          {(control) => <Input {...control} name="addressLine1" defaultValue={defaults.addressLine1} />}
        </FormField>
        <FormField id="addressLine2" label="Address line 2" error={errors.addressLine2}>
          {(control) => <Input {...control} name="addressLine2" defaultValue={defaults.addressLine2} />}
        </FormField>
        <FormField id="postcode" label="Postcode" error={errors.postcode}>
          {(control) => <Input {...control} name="postcode" defaultValue={defaults.postcode} />}
        </FormField>
        <FormField id="city" label="City" error={errors.city}>
          {(control) => <Input {...control} name="city" defaultValue={defaults.city} />}
        </FormField>
        <FormField id="country" label="Country" error={errors.country}>
          {(control) => <Input {...control} name="country" defaultValue={defaults.country} />}
        </FormField>
        <FormField id="phone" label="Phone" error={errors.phone}>
          {(control) => <Input {...control} name="phone" type="tel" defaultValue={defaults.phone} />}
        </FormField>
        <FormField id="email" label="E-mail" error={errors.email}>
          {(control) => <Input {...control} name="email" type="email" defaultValue={defaults.email} />}
        </FormField>
      </fieldset>

      {isClient || errors.clientCode ? (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-base font-medium">Client settings</legend>
          <FormField
            id="clientCode"
            label="Client code"
            error={errors.clientCode}
            hint="3 or 4 capital letters. Every case number starts with it (BR-01)."
          >
            {(control) => (
              <Input
                {...control}
                name="clientCode"
                maxLength={4}
                autoCapitalize="characters"
                defaultValue={defaults.clientCode}
              />
            )}
          </FormField>
          <div className="self-end pb-2">
            <CheckboxField
              name="requiresVdaPo"
              label="Requires VDA and PO numbers (BR-11)"
              defaultChecked={defaults.requiresVdaPo}
            />
          </div>
        </fieldset>
      ) : null}

      {isRepairer ? (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-base font-medium">Repairer settings</legend>
          <FormField
            id="discountPct"
            label="Discount (%)"
            error={errors.discountPct}
            hint="Agreed total discount (BR-09)."
          >
            {(control) => (
              <Input
                {...control}
                name="discountPct"
                inputMode="decimal"
                defaultValue={defaults.discountPct}
              />
            )}
          </FormField>
          <div className="self-end pb-2">
            <CheckboxField
              name="isNetworkMember"
              label="Member of the repair network"
              defaultChecked={defaults.isNetworkMember}
            />
          </div>
          <FormField
            id="invoicingConditions"
            label="Invoicing conditions"
            error={errors.invoicingConditions}
            hint="Printed on the repair order (BR-09)."
            className="sm:col-span-2"
          >
            {(control) => (
              <Textarea
                {...control}
                name="invoicingConditions"
                rows={3}
                defaultValue={defaults.invoicingConditions}
              />
            )}
          </FormField>
        </fieldset>
      ) : null}
    </>
  );
}
