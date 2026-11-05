"use client";

import { startTransition, useActionState, useState } from "react";

import { CheckboxField, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatMoney, parseMoney } from "@/domain/shared/money";
import {
  amountInclVat,
  ASSESSMENT_TYPE_LABELS,
  ASSESSMENT_TYPES,
  expertAssessmentType,
  type AssessmentType,
} from "@/domain/quotes/validation";
import { CASE_STATUS_LABELS } from "@/domain/cases/case-status";

import type { ValidateFormState } from "./actions";

type Action = (state: ValidateFormState, formData: FormData) => Promise<ValidateFormState>;

/**
 * UC-22: the Validate dialog. On confirm the post-calculation is validated
 * and the status changes automatically to "File follow-up – repairer (expert
 * report OK)" (BR-03).
 */
export function ValidateDialog({
  action,
  postTotal,
  hasExpertReport,
  expertReportName,
}: {
  action: Action;
  postTotal: number;
  hasExpertReport: boolean;
  expertReportName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ValidateFormState, FormData>(
    async (previous, formData) => {
      const next = await action(previous, formData);
      if (next.saved) {
        setOpen(false);
      }
      return next;
    },
    { version: 0 },
  );
  const [remote, setRemote] = useState(false);
  const [type, setType] = useState<AssessmentType>(hasExpertReport ? "on_site" : "approval_without_expert");
  const [vatApplicable, setVatApplicable] = useState(true);
  const [amount, setAmount] = useState(postTotal.toFixed(2).replace(".", ","));
  const errors = state.fieldErrors ?? {};
  const typedAmount = parseMoney(amount);
  const inclVat =
    typedAmount === null || Number.isNaN(typedAmount) ? null : amountInclVat(typedAmount, vatApplicable);
  // BR-04: with an expert report the type follows from "remote assessment".
  const assessmentType = hasExpertReport ? expertAssessmentType(remote) : type;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Validate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Validate the post-calculation</DialogTitle>
            <DialogDescription>
              The status changes automatically to “{CASE_STATUS_LABELS.followup_repairer_report_ok}” (BR-03).
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              // A form action resets the form after a rejected attempt, which
              // unticks controlled checkboxes; submitting by hand keeps them.
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(() => formAction(formData));
            }}
          >
            {state.formError ? (
              <p role="alert" className="text-sm text-destructive">
                {state.formError}
              </p>
            ) : null}

            {hasExpertReport ? (
              <div className="grid gap-2 rounded-lg border p-3">
                <p className="text-sm">
                  Expert report: <span className="font-medium">{expertReportName}</span>
                </p>
                <CheckboxField
                  name="remoteAssessment"
                  label="The expert assessed the damage remotely (Smart Expertise, BR-04)"
                  checked={remote}
                  onCheckedChange={setRemote}
                />
                <CheckboxField
                  name="reportMatchesCase"
                  label="I checked that the report's remarks match this case's damage (BR-06)"
                />
                {errors.reportMatchesCase?.[0] ? (
                  <p className="text-sm text-destructive">{errors.reportMatchesCase[0]}</p>
                ) : null}
              </div>
            ) : null}

            <FormField id="assessmentType" label="Assessment type" error={errors.assessmentType}>
              {(control) => (
                <>
                  <NativeSelect
                    {...control}
                    value={assessmentType}
                    disabled={hasExpertReport}
                    onChange={(event) => setType(event.target.value as AssessmentType)}
                    className="w-full"
                  >
                    {ASSESSMENT_TYPES.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {ASSESSMENT_TYPE_LABELS[value]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {/* A disabled select is not submitted. */}
                  <input type="hidden" name="assessmentType" value={assessmentType} />
                </>
              )}
            </FormField>

            <CheckboxField name="vatApplicable" label="VAT applicable" checked={vatApplicable} onCheckedChange={setVatApplicable} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="approvedAmountExclVat" label="Approved amount excl. VAT (€)" error={errors.approvedAmountExclVat}>
                {(control) => (
                  <Input
                    {...control}
                    name="approvedAmountExclVat"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                )}
              </FormField>
              <div className="grid content-start gap-2">
                <p className="text-sm font-medium">Approved amount incl. VAT</p>
                <p className="flex h-8 items-center text-sm tabular-nums" aria-live="polite">
                  {inclVat === null ? "—" : formatMoney(inclVat)}
                  {vatApplicable ? <span className="ml-2 text-xs text-muted-foreground">(21% VAT)</span> : null}
                </p>
              </div>
            </div>

            <FormField
              id="lossOfUseDays"
              label="Loss-of-use days"
              error={errors.lossOfUseDays}
              hint="The repair duration stated by the expert (BR-05)."
            >
              {(control) => <Input {...control} name="lossOfUseDays" inputMode="numeric" className="max-w-32" />}
            </FormField>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Validating…" : "Confirm validation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
