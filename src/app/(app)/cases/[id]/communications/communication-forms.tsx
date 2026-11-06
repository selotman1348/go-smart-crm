"use client";

import { useActionState } from "react";

import { FormMessages } from "@/components/form-actions";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { formDefaults, initialFormState } from "../../../form-state";
import type { CommunicationFormState } from "./actions";

type Action = (state: CommunicationFormState, formData: FormData) => Promise<CommunicationFormState>;
type Option = { value: string; label: string };

/** UC-33: choose a template and a language; the e-mail opens as a draft. */
export function NewEmailForm({ action, templates, languages }: { action: Action; templates: Option[]; languages: Option[] }) {
  const [state, formAction, pending] = useActionState<CommunicationFormState, FormData>(action, initialFormState);
  const defaults = formDefaults(state.values, { templateCode: "general", language: "en" });

  return (
    <form action={formAction} aria-label="New e-mail" className="grid gap-3">
      <FormMessages formError={state.formError} hasFieldErrors={false} />
      <div key={state.version} className="flex flex-wrap items-end gap-3">
        <FormField id="templateCode" label="Template" className="min-w-72 flex-1">
          {(control) => (
            <NativeSelect {...control} name="templateCode" defaultValue={defaults.text("templateCode")} className="w-full">
              {templates.map((template) => (
                <NativeSelectOption key={template.value} value={template.value}>
                  {template.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id="language" label="Language">
          {(control) => (
            <NativeSelect {...control} name="language" defaultValue={defaults.text("language")}>
              {languages.map((language) => (
                <NativeSelectOption key={language.value} value={language.value}>
                  {language.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <Button type="submit" disabled={pending}>
          {pending ? "Preparing…" : "Write e-mail"}
        </Button>
      </div>
    </form>
  );
}

/** UC-35: "Add communication" for a phone call or other contact. */
export function LogContactForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<CommunicationFormState, FormData>(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const defaults = formDefaults(state.values, { channel: "phone", direction: "in" });

  return (
    <form action={formAction} aria-label="Add communication" className="grid gap-4">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} saved={state.saved} />
      <div key={state.version} className="grid gap-4 sm:grid-cols-3">
        <FormField id="channel" label="Type" error={errors.channel}>
          {(control) => (
            <NativeSelect {...control} name="channel" defaultValue={defaults.text("channel")} className="w-full">
              <NativeSelectOption value="phone">Phone call</NativeSelectOption>
              <NativeSelectOption value="other">Other</NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>
        <FormField id="direction" label="Direction" error={errors.direction}>
          {(control) => (
            <NativeSelect {...control} name="direction" defaultValue={defaults.text("direction")} className="w-full">
              <NativeSelectOption value="in">Incoming</NativeSelectOption>
              <NativeSelectOption value="out">Outgoing</NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>
        <FormField id="occurredAt" label="Date and time" error={errors.occurredAt} hint="Empty means now.">
          {(control) => <Input {...control} type="datetime-local" name="occurredAt" defaultValue={defaults.text("occurredAt")} />}
        </FormField>
        <FormField id="subject" label="Subject" error={errors.subject} className="sm:col-span-3">
          {(control) => <Input {...control} name="subject" defaultValue={defaults.text("subject")} />}
        </FormField>
        <FormField id="body" label="Notes" error={errors.body} className="sm:col-span-3">
          {(control) => <Textarea {...control} name="body" rows={4} defaultValue={defaults.text("body")} />}
        </FormField>
      </div>
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Add communication"}
        </Button>
      </div>
    </form>
  );
}
