"use client";

import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { initialFormState } from "../form-state";
import type { LinkFormState } from "./actions";

type Action = (state: LinkFormState, formData: FormData) => Promise<LinkFormState>;

/** "Link to case": the e-mail and its attachments go to the case with this number. */
export function LinkToCaseForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<LinkFormState, FormData>(action, initialFormState);
  const value = typeof state.values?.caseNumber === "string" ? state.values.caseNumber : "";

  return (
    <form action={formAction} aria-label="Link to case" className="flex flex-wrap items-start gap-2">
      <FormField id="caseNumber" label="Case number" error={state.fieldErrors?.caseNumber} className="w-56">
        {(control) => <Input key={state.version} {...control} name="caseNumber" defaultValue={value} placeholder="DEM20260001" />}
      </FormField>
      <Button type="submit" variant="outline" disabled={pending} className="sm:mt-7">
        {pending ? "Linking…" : "Link to case"}
      </Button>
    </form>
  );
}
