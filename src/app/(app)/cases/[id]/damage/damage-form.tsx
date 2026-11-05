"use client";

import { useActionState } from "react";

import { CheckboxField, FormField } from "@/components/form-field";
import { FormActions, FormMessages } from "@/components/form-actions";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DamageField } from "@/domain/damage/damage-input";

import { formDefaults, initialFormState, type FormState } from "../../../form-state";

type Action = (state: FormState<DamageField>, formData: FormData) => Promise<FormState<DamageField>>;
type Option = { value: string; label: string };

/** UC-12: damage details and the damaged-parts checklist. */
export function DamageForm({
  action,
  stored,
  liabilities,
  circumstances,
  parts,
}: {
  action: Action;
  stored: Record<string, string | string[] | null>;
  liabilities: Option[];
  circumstances: Option[];
  parts: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState<DamageField>, FormData>(action, initialFormState);
  const defaults = formDefaults(state.values, stored);
  const errors = state.fieldErrors ?? {};
  const checkedParts = defaults.list("parts");

  const text = (name: DamageField, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <FormField id={name} label={label} error={errors[name]}>
      {(control) => <Input {...control} {...props} name={name} defaultValue={defaults.text(name)} />}
    </FormField>
  );
  const select = (name: DamageField, label: string, options: Option[]) => (
    <FormField id={name} label={label} error={errors[name]}>
      {(control) => (
        <NativeSelect {...control} name={name} defaultValue={defaults.text(name)} className="w-full">
          <NativeSelectOption value="">Not set</NativeSelectOption>
          {options.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );

  return (
    <form action={formAction} className="grid gap-8">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} saved={state.saved} />
      <div key={state.version} className="grid gap-8">
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-base font-medium">Damage</legend>
          {text("damageDate", "Damage date", { type: "date" })}
          {text("mileageIn", "Mileage in (km)", { inputMode: "numeric" })}
          {text("mileageOut", "Mileage out (km)", { inputMode: "numeric" })}
          {select("liability", "Liability", liabilities)}
          {select("circumstances", "Circumstances", circumstances)}
          <FormField id="cause" label="Cause" error={errors.cause} className="sm:col-span-3">
            {(control) => <Textarea {...control} name="cause" rows={2} defaultValue={defaults.text("cause")} />}
          </FormField>
          <FormField id="extraInfo" label="Extra information" error={errors.extraInfo} className="sm:col-span-3">
            {(control) => (
              <Textarea {...control} name="extraInfo" rows={3} defaultValue={defaults.text("extraInfo")} />
            )}
          </FormField>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-base font-medium">Damage location</legend>
          {text("addressLine1", "Address line 1")}
          {text("addressLine2", "Address line 2")}
          {text("postcode", "Postcode")}
          {text("city", "City")}
          {text("country", "Country")}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-base font-medium">Damaged parts</legend>
          <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {parts.map((part) => (
              <CheckboxField
                key={part.value}
                name="parts"
                value={part.value}
                label={part.label}
                defaultChecked={checkedParts.includes(part.value)}
              />
            ))}
          </div>
          {errors.parts?.[0] ? <p className="text-sm text-destructive">{errors.parts[0]}</p> : null}
        </fieldset>
      </div>
      <FormActions pending={pending} closeHref="/cases" />
    </form>
  );
}
