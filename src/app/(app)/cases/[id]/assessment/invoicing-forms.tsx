"use client";

import { useActionState } from "react";

import { FormMessages } from "@/components/form-actions";
import { CheckboxField, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { formDefaults, initialFormState } from "../../../form-state";
import type { AssessmentFormState } from "./actions";

type Action = (state: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>;

/** UC-29: the repairer invoice – received, date, number, amount and the uploaded invoice. */
export function RepairerInvoiceForm({
  action,
  documents,
  stored,
  disabled,
}: {
  action: Action;
  documents: { value: string; label: string }[];
  stored: { received: boolean; receivedDate: string; invoiceNumber: string; amountExclVat: string; documentId: string };
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<AssessmentFormState, FormData>(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const defaults = formDefaults(state.values, stored);

  return (
    <form action={formAction} aria-label="Repairer invoice" className="grid gap-4">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} saved={state.saved} />
      <div key={state.version} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CheckboxField name="received" label="Repairer invoice received" defaultChecked={defaults.checked("received")} />
        </div>
        <FormField id="receivedDate" label="Received on" error={errors.receivedDate}>
          {(control) => <Input {...control} type="date" name="receivedDate" defaultValue={defaults.text("receivedDate")} disabled={disabled} />}
        </FormField>
        <FormField id="invoiceNumber" label="Repairer's invoice number" error={errors.invoiceNumber}>
          {(control) => <Input {...control} name="invoiceNumber" defaultValue={defaults.text("invoiceNumber")} disabled={disabled} />}
        </FormField>
        <FormField id="amountExclVat" label="Amount excl. VAT (€)" error={errors.amountExclVat}>
          {(control) => (
            <Input {...control} name="amountExclVat" inputMode="decimal" defaultValue={defaults.text("amountExclVat")} disabled={disabled} />
          )}
        </FormField>
        <FormField
          id="documentId"
          label="Invoice document"
          error={errors.documentId}
          hint={documents.length === 0 ? "Upload the invoice below first." : undefined}
        >
          {(control) => (
            <NativeSelect {...control} name="documentId" defaultValue={defaults.text("documentId")} disabled={disabled} className="w-full">
              <NativeSelectOption value="">No document</NativeSelectOption>
              {documents.map((document) => (
                <NativeSelectOption key={document.value} value={document.value}>
                  {document.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <div>
        <Button type="submit" disabled={pending || disabled}>
          {pending ? "Saving…" : "Save repairer invoice"}
        </Button>
      </div>
    </form>
  );
}

/** UC-31: the sales invoice number from accounting closes the case. */
export function SalesInvoiceForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<AssessmentFormState, FormData>(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const defaults = formDefaults(state.values, {});

  return (
    <form action={formAction} aria-label="Sales invoice" className="grid gap-4">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} />
      <div key={state.version} className="grid gap-4 sm:grid-cols-2">
        <FormField id="salesInvoiceNumber" label="Sales invoice number" error={errors.invoiceNumber}>
          {(control) => <Input {...control} name="invoiceNumber" defaultValue={defaults.text("invoiceNumber")} />}
        </FormField>
        <FormField id="salesAmountExclVat" label="Amount excl. VAT (€)" error={errors.amountExclVat} hint="Optional.">
          {(control) => <Input {...control} name="amountExclVat" inputMode="decimal" defaultValue={defaults.text("amountExclVat")} />}
        </FormField>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record the sales invoice and close the case"}
        </Button>
      </div>
    </form>
  );
}
