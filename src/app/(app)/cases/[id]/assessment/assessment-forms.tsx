"use client";

import { useActionState, useState } from "react";

import { CheckboxField, FormField } from "@/components/form-field";
import { FormMessages } from "@/components/form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { proposedTotalLossAmount } from "@/domain/assessment/repair-decision";
import { formatMoney, parseMoney } from "@/domain/shared/money";

import { formDefaults, type FormValues } from "../../../form-state";
import type { AssessmentFormState } from "./actions";

type Action = (state: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>;
type Option = { value: string; label: string };

function useAssessmentForm(action: Action) {
  return useActionState<AssessmentFormState, FormData>(action, { version: 0 });
}

/** UC-23/24: which expert assessed the damage and which document is the report. */
export function ExpertForm({
  action,
  experts,
  reports,
  stored,
}: {
  action: Action;
  experts: Option[];
  reports: Option[];
  stored: { expertAccountId: string; expertReportDocumentId: string };
}) {
  const [state, formAction, pending] = useAssessmentForm(action);
  const defaults = formDefaults(state.values, stored);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} saved={state.saved} />
      <div key={state.version} className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="expertAccountId"
          label="Expert"
          error={errors.expertAccountId}
          hint={experts.length === 0 ? "Add the expert on the Parties tab first (UC-23)." : undefined}
        >
          {(control) => (
            <NativeSelect {...control} name="expertAccountId" defaultValue={defaults.text("expertAccountId")} className="w-full">
              <NativeSelectOption value="">No expert</NativeSelectOption>
              {experts.map((expert) => (
                <NativeSelectOption key={expert.value} value={expert.value}>
                  {expert.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          id="expertReportDocumentId"
          label="Expert report"
          error={errors.expertReportDocumentId}
          hint={reports.length === 0 ? "Upload the report below with the category “Expert report”." : undefined}
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="expertReportDocumentId"
              defaultValue={defaults.text("expertReportDocumentId")}
              className="w-full"
            >
              <NativeSelectOption value="">No report yet</NativeSelectOption>
              {reports.map((report) => (
                <NativeSelectOption key={report.value} value={report.value}>
                  {report.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save expert assessment"}
        </Button>
      </div>
    </form>
  );
}

const amountOrNull = (text: string) => {
  const amount = parseMoney(text);
  return amount === null || Number.isNaN(amount) ? null : amount;
};

/** UC-26: total-loss figures; the damage amount is proposed and can be changed. */
export function TotalLossForm({ action, disabled }: { action: Action; disabled: boolean }) {
  const [state, formAction, pending] = useAssessmentForm(action);
  const errors = state.fieldErrors ?? {};
  const submitted = state.values as FormValues | undefined;
  const [figures, setFigures] = useState({
    vehicleValue: String(submitted?.vehicleValue ?? ""),
    previousDamageDeduction: String(submitted?.previousDamageDeduction ?? ""),
    accessories: String(submitted?.accessories ?? ""),
    wreckValue: String(submitted?.wreckValue ?? ""),
  });
  const vehicleValue = amountOrNull(figures.vehicleValue);
  const proposed =
    vehicleValue === null
      ? null
      : proposedTotalLossAmount({
          vehicleValue,
          previousDamageDeduction: amountOrNull(figures.previousDamageDeduction),
          accessories: amountOrNull(figures.accessories),
          wreckValue: amountOrNull(figures.wreckValue),
        });
  const field = (name: keyof typeof figures, label: string) => (
    <FormField id={name} label={label} error={errors[name]}>
      {(control) => (
        <Input
          {...control}
          name={name}
          inputMode="decimal"
          value={figures[name]}
          disabled={disabled}
          onChange={(event) => setFigures({ ...figures, [name]: event.target.value })}
        />
      )}
    </FormField>
  );

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} />
      <div className="grid gap-4 sm:grid-cols-2">
        {field("vehicleValue", "Vehicle value before the incident (€)")}
        {field("previousDamageDeduction", "Deduction for previous damage (€)")}
        {field("accessories", "Accessories (€)")}
        {field("wreckValue", "Wreck value (€)")}
        <FormField
          id="damageAmount"
          label="Total damage amount (€)"
          error={errors.damageAmount}
          hint={
            proposed === null
              ? "Proposed as vehicle value − previous damage + accessories − wreck value."
              : `Proposed: ${formatMoney(proposed)}. Leave empty to use it, or enter the amount from the expert report.`
          }
        >
          {(control) => (
            <Input
              {...control}
              name="damageAmount"
              inputMode="decimal"
              disabled={disabled}
              defaultValue={String(submitted?.damageAmount ?? "")}
            />
          )}
        </FormField>
      </div>
      <div>
        <Button type="submit" variant="destructive" disabled={pending || disabled}>
          {pending ? "Recording…" : "Record total loss and close the case"}
        </Button>
      </div>
    </form>
  );
}

/** UC-27 / BR-07: no repair, with a reason; the repairer must be notified. */
export function NoRepairForm({ action, reasons, disabled }: { action: Action; reasons: Option[]; disabled: boolean }) {
  const [state, formAction, pending] = useAssessmentForm(action);
  const errors = state.fieldErrors ?? {};
  const defaults = formDefaults(state.values, {});

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} />
      <div key={state.version} className="grid gap-4 sm:grid-cols-2">
        <FormField id="reason" label="Reason" error={errors.reason}>
          {(control) => (
            <NativeSelect {...control} name="reason" defaultValue={defaults.text("reason")} disabled={disabled} className="w-full">
              <NativeSelectOption value="">Choose a reason…</NativeSelectOption>
              {reasons.map((reason) => (
                <NativeSelectOption key={reason.value} value={reason.value}>
                  {reason.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id="reasonText" label="Note" error={errors.reasonText}>
          {(control) => (
            <Input {...control} name="reasonText" defaultValue={defaults.text("reasonText")} disabled={disabled} />
          )}
        </FormField>
        <div className="grid gap-1 sm:col-span-2">
          <CheckboxField
            name="repairerNotified"
            label="The repairer has been told not to start the repair (BR-07)"
            defaultChecked={defaults.checked("repairerNotified")}
          />
          {errors.repairerNotified?.[0] ? (
            <p className="text-sm text-destructive">{errors.repairerNotified[0]}</p>
          ) : null}
        </div>
      </div>
      <div>
        <Button type="submit" variant="destructive" disabled={pending || disabled}>
          {pending ? "Recording…" : "Record no repair and close the case"}
        </Button>
      </div>
    </form>
  );
}
