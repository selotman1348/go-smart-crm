"use client";

import { useActionState, useState } from "react";

import { CheckboxField, FormField } from "@/components/form-field";
import { FormActions, FormMessages } from "@/components/form-actions";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CaseHeaderField } from "@/domain/cases/case-header-input";
import type { CaseWarning } from "@/domain/cases/case-warnings";

import { formDefaults, initialFormState, type FormState } from "../../form-state";

type Action = (state: FormState<CaseHeaderField>, formData: FormData) => Promise<FormState<CaseHeaderField>>;
type Option = { value: string; label: string };

export function CaseHeaderForm({
  action,
  stored,
  users,
  onHoldReasons,
  tags,
  warnings,
}: {
  action: Action;
  /** Stored values as form values; appointments already in Brussels wall-clock time. */
  stored: Record<string, string | string[] | boolean | null>;
  users: Option[];
  onHoldReasons: Option[];
  tags: Option[];
  warnings: CaseWarning[];
}) {
  const [state, formAction, pending] = useActionState<FormState<CaseHeaderField>, FormData>(
    action,
    initialFormState,
  );

  return (
    <form action={formAction} className="grid gap-8">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} saved={state.saved} />
      <CaseHeaderFields
        key={state.version}
        defaults={formDefaults(state.values, stored)}
        errors={state.fieldErrors ?? {}}
        users={users}
        onHoldReasons={onHoldReasons}
        tags={tags}
        warnings={warnings}
      />
      <FormActions pending={pending} closeHref="/cases" />
    </form>
  );
}

function CaseHeaderFields({
  defaults,
  errors,
  users,
  onHoldReasons,
  tags,
  warnings,
}: {
  defaults: ReturnType<typeof formDefaults>;
  errors: Partial<Record<CaseHeaderField, string[]>>;
  users: Option[];
  onHoldReasons: Option[];
  tags: Option[];
  warnings: CaseWarning[];
}) {
  const [onHold, setOnHold] = useState(defaults.checked("onHold"));
  const text = (name: CaseHeaderField, label: string, type = "text") => (
    <FormField id={name} label={label} error={errors[name]}>
      {(control) => <Input {...control} name={name} type={type} defaultValue={defaults.text(name)} />}
    </FormField>
  );
  const userSelect = (name: CaseHeaderField, label: string) => (
    <FormField id={name} label={label} error={errors[name]}>
      {(control) => (
        <NativeSelect {...control} name={name} defaultValue={defaults.text(name)} className="w-full">
          <NativeSelectOption value="">Nobody</NativeSelectOption>
          {users.map((user) => (
            <NativeSelectOption key={user.value} value={user.value}>
              {user.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );

  return (
    <>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-medium">References</legend>
        {text("insurerRef", "Insurer ref.")}
        {text("brokerRef", "Broker ref.")}
        {text("expertRef", "Expert ref.")}
        {text("leasingRef", "Leasing ref.")}
        {text("policyNumber", "Policy number")}
        {text("coverType", "Cover type")}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-medium">Client references (BR-11)</legend>
        {warnings.map((warning) => (
          <p
            key={warning.message}
            role="note"
            className="rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2 dark:bg-amber-950 dark:text-amber-100"
          >
            {warning.message}
          </p>
        ))}
        {text("vdaNumber", "VDA number")}
        {text("poNumber", "PO number")}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-medium">Financial</legend>
        <FormField id="vatLiablePct" label="VAT liable (%)" error={errors.vatLiablePct}>
          {(control) => (
            <Input {...control} name="vatLiablePct" inputMode="decimal" defaultValue={defaults.text("vatLiablePct")} />
          )}
        </FormField>
        <FormField id="deductible" label="Deductible (€)" error={errors.deductible}>
          {(control) => (
            <Input {...control} name="deductible" inputMode="decimal" defaultValue={defaults.text("deductible")} />
          )}
        </FormField>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 text-base font-medium">Dates</legend>
        {text("assignmentDate", "Assignment", "date")}
        {text("completionDate", "Completion", "date")}
        {text("collectedDate", "Collected", "date")}
        {text("deliveredDate", "Delivered", "date")}
        {text("vehicleInDate", "Vehicle in", "date")}
        {text("vehicleReadyDate", "Vehicle ready", "date")}
        {text("clientNotifiedDate", "Client notified", "date")}
        {text("vehicleOutDate", "Vehicle out", "date")}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-medium">Appointments</legend>
        {text("appointmentEstimateAt", "Estimate appointment", "datetime-local")}
        {text("appointmentRepairAt", "Repair appointment", "datetime-local")}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-medium">Handling</legend>
        {userSelect("managerUserId", "Case manager")}
        {userSelect("assignedToUserId", "Assigned to")}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-medium">On hold (UC-28)</legend>
        <div className="sm:col-span-2">
          <CheckboxField name="onHold" label="Put the case on hold" checked={onHold} onCheckedChange={setOnHold} />
        </div>
        {onHold ? (
          <>
            <FormField id="onHoldReason" label="Reason" error={errors.onHoldReason}>
              {(control) => (
                <NativeSelect
                  {...control}
                  name="onHoldReason"
                  defaultValue={defaults.text("onHoldReason")}
                  className="w-full"
                >
                  <NativeSelectOption value="">Choose a reason…</NativeSelectOption>
                  {onHoldReasons.map((reason) => (
                    <NativeSelectOption key={reason.value} value={reason.value}>
                      {reason.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            {text("onHoldReasonText", "Note")}
          </>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-base font-medium">Tags</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {tags.map((tag) => (
            <CheckboxField
              key={tag.value}
              name="tagIds"
              value={tag.value}
              label={tag.label}
              defaultChecked={defaults.list("tagIds").includes(tag.value)}
            />
          ))}
        </div>
        <FormField id="newTag" label="New tag" error={errors.newTag} className="max-w-xs">
          {(control) => <Input {...control} name="newTag" defaultValue={defaults.text("newTag")} />}
        </FormField>
      </fieldset>
    </>
  );
}
