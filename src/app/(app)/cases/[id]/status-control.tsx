"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CASE_STATUS_LABELS, CASE_STATUSES, type CaseStatus } from "@/domain/cases/case-status";

import type { StatusFormState } from "./actions";

type Action = (state: StatusFormState, formData: FormData) => Promise<StatusFormState>;

/** Any status can be set manually (design.md section 2); the change is recorded in the history. */
export function StatusControl({ action, status }: { action: Action; status: CaseStatus }) {
  const [state, formAction, pending] = useActionState<StatusFormState, FormData>(action, { version: 0 });

  return (
    <form action={formAction} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="new-status" className="text-sm text-muted-foreground">
          Status
        </Label>
        <NativeSelect key={`${status}-${state.version}`} id="new-status" name="status" defaultValue={status}>
          {CASE_STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {CASE_STATUS_LABELS[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Changing…" : "Change status"}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
