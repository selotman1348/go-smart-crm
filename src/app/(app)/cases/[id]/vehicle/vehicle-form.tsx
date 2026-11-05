"use client";

import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { FormActions, FormMessages } from "@/components/form-actions";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_LABELS, type VehicleField } from "@/domain/vehicles/vehicle-input";

import { formDefaults, initialFormState, type FormState } from "../../../form-state";

type Action = (state: FormState<VehicleField>, formData: FormData) => Promise<FormState<VehicleField>>;
type Option = { value: string; label: string };

/** UC-10: maintain the vehicle. */
export function VehicleForm({
  action,
  stored,
  owners,
  leasingCompanies,
  vehicleId,
}: {
  action: Action;
  stored: Record<string, string | null>;
  owners: Option[];
  leasingCompanies: Option[];
  /** The stored vehicle; the fields reload when it changes (created or linked). */
  vehicleId: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState<VehicleField>, FormData>(action, initialFormState);
  const defaults = formDefaults(state.values, stored);
  const errors = state.fieldErrors ?? {};
  const isNew = vehicleId === null;

  const text = (name: VehicleField, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <FormField id={name} label={label} error={errors[name]}>
      {(control) => <Input {...control} {...props} name={name} defaultValue={defaults.text(name)} />}
    </FormField>
  );
  const select = (name: VehicleField, label: string, options: Option[], empty: string) => (
    <FormField id={name} label={label} error={errors[name]}>
      {(control) => (
        <NativeSelect {...control} name={name} defaultValue={defaults.text(name)} className="w-full">
          <NativeSelectOption value="">{empty}</NativeSelectOption>
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
      <div key={`${state.version}-${vehicleId ?? "new"}`} className="grid gap-8">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-base font-medium">{isNew ? "New vehicle" : "Identification"}</legend>
          {text("licencePlate", "Licence plate", { required: true, autoCapitalize: "characters" })}
          {text("vin", "VIN (chassis number)", { maxLength: 20, autoCapitalize: "characters" })}
          {text("firstRegistrationDate", "First registration", { type: "date" })}
          {select(
            "category",
            "Category",
            VEHICLE_CATEGORIES.map((value) => ({ value, label: VEHICLE_CATEGORY_LABELS[value] })),
            "Not set",
          )}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-base font-medium">Model</legend>
          {text("make", "Make")}
          {text("model", "Model")}
          {text("modelYear", "Model year", { inputMode: "numeric" })}
          {text("typeDesignation", "Type")}
          {text("colour", "Colour")}
          {text("paintType", "Paint type")}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-base font-medium">Ownership</legend>
          {select("ownerAccountId", "Owner (fleet owner)", owners, isNew ? "The case's client" : "Not set")}
          {select("leasingAccountId", "Leasing company", leasingCompanies, "None")}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="mb-2 text-base font-medium">Technical (optional)</legend>
          {text("powerKw", "Power (kW)", { inputMode: "numeric" })}
          {text("engineCc", "Engine (cc)", { inputMode: "numeric" })}
          {text("co2", "CO₂ (g/km)", { inputMode: "numeric" })}
          {text("seats", "Seats", { inputMode: "numeric" })}
        </fieldset>
      </div>
      <FormActions pending={pending} closeHref="/cases" />
    </form>
  );
}
