"use client";

import { useActionState } from "react";

import { FormMessages } from "@/components/form-actions";
import { CheckboxField, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { formDefaults, initialFormState } from "../../../../../form-state";
import type { CommunicationFormState } from "../../actions";

type Action = (state: CommunicationFormState, formData: FormData) => Promise<CommunicationFormState>;

export type ComposeStored = {
  to: string;
  cc: string;
  subject: string;
  body: string;
  attachRepairOrder: boolean;
};

/** UC-33: To/Cc/Bcc, subject, message and attachments; Send or keep as a draft. */
export function ComposeForm({
  action,
  stored,
  documents,
  repairOrderUrl,
}: {
  action: Action;
  stored: ComposeStored;
  documents: { id: string; label: string }[];
  repairOrderUrl: string;
}) {
  const [state, formAction, pending] = useActionState<CommunicationFormState, FormData>(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const defaults = formDefaults(state.values, { ...stored, bcc: "", linkCaseNumbers: "", documentIds: [] });
  const chosen = defaults.list("documentIds");

  return (
    <form action={formAction} aria-label="Compose e-mail" className="grid gap-4">
      <FormMessages
        formError={state.formError}
        hasFieldErrors={Boolean(state.fieldErrors)}
        saved={state.saved}
      />
      <div key={state.version} className="grid gap-4">
        <FormField id="to" label="To" error={errors.to} hint="Separate addresses with commas.">
          {(control) => <Input {...control} name="to" defaultValue={defaults.text("to")} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="cc" label="Cc" error={errors.cc}>
            {(control) => <Input {...control} name="cc" defaultValue={defaults.text("cc")} />}
          </FormField>
          <FormField id="bcc" label="Bcc" error={errors.bcc} hint="Not kept with a draft.">
            {(control) => <Input {...control} name="bcc" defaultValue={defaults.text("bcc")} />}
          </FormField>
        </div>
        <FormField id="subject" label="Subject" error={errors.subject}>
          {(control) => <Input {...control} name="subject" defaultValue={defaults.text("subject")} />}
        </FormField>
        <FormField id="body" label="Message" error={errors.body}>
          {(control) => <Textarea {...control} name="body" rows={16} defaultValue={defaults.text("body")} />}
        </FormField>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Attachments</legend>
          <div className="flex flex-wrap items-center gap-3">
            <CheckboxField
              name="attachRepairOrder"
              label="Repair order (generated PDF)"
              defaultChecked={state.values ? defaults.checked("attachRepairOrder") : stored.attachRepairOrder}
            />
            <a href={repairOrderUrl} target="_blank" rel="noreferrer" className="text-sm hover:underline">
              Preview the repair order
            </a>
          </div>
          {documents.map((document) => (
            <CheckboxField
              key={document.id}
              name="documentIds"
              value={document.id}
              label={document.label}
              defaultChecked={chosen.includes(document.id)}
            />
          ))}
          {errors.documentIds?.[0] ? <p className="text-sm text-destructive">{errors.documentIds[0]}</p> : null}
        </fieldset>

        <FormField
          id="linkCaseNumbers"
          label="Also log on cases"
          error={errors.linkCaseNumbers}
          hint="Case numbers, separated by commas, when the e-mail concerns several cases (BR-12)."
        >
          {(control) => <Input {...control} name="linkCaseNumbers" defaultValue={defaults.text("linkCaseNumbers")} />}
        </FormField>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="send" disabled={pending}>
          {pending ? "Working…" : "Send"}
        </Button>
        <Button type="submit" name="intent" value="save" variant="outline" disabled={pending}>
          Save draft
        </Button>
      </div>
    </form>
  );
}
