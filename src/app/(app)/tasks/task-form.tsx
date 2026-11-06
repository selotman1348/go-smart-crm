"use client";

import { useActionState } from "react";

import { FormMessages } from "@/components/form-actions";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { formDefaults, initialFormState } from "../form-state";
import type { TaskFormState } from "./actions";

type Action = (state: TaskFormState, formData: FormData) => Promise<TaskFormState>;
type Option = { value: string; label: string };

/** UC-03: a new task, optionally for a case. */
export function TaskForm({
  action,
  categories,
  users,
  defaultCategory,
}: {
  action: Action;
  categories: Option[];
  users: Option[];
  defaultCategory: string;
}) {
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const defaults = formDefaults(state.values, { category: defaultCategory });

  return (
    <form action={formAction} aria-label="New task" className="grid gap-4 rounded-lg border p-4">
      <FormMessages formError={state.formError} hasFieldErrors={Boolean(state.fieldErrors)} saved={state.saved} />
      <div key={state.version} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FormField id="title" label="Task" error={errors.title} className="sm:col-span-2">
          {(control) => <Input {...control} name="title" defaultValue={defaults.text("title")} />}
        </FormField>
        <FormField id="category" label="Category" error={errors.category}>
          {(control) => (
            <NativeSelect {...control} name="category" defaultValue={defaults.text("category")} className="w-full">
              {categories.map((category) => (
                <NativeSelectOption key={category.value} value={category.value}>
                  {category.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id="dueDate" label="Due date" error={errors.dueDate}>
          {(control) => <Input {...control} type="date" name="dueDate" defaultValue={defaults.text("dueDate")} />}
        </FormField>
        <FormField id="assigneeUserId" label="Assigned to" error={errors.assigneeUserId} hint="“My tasks” default to you.">
          {(control) => (
            <NativeSelect {...control} name="assigneeUserId" defaultValue={defaults.text("assigneeUserId")} className="w-full">
              <NativeSelectOption value="">Nobody</NativeSelectOption>
              {users.map((user) => (
                <NativeSelectOption key={user.value} value={user.value}>
                  {user.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id="caseNumber" label="Case number" error={errors.caseNumber} hint="Optional.">
          {(control) => <Input {...control} name="caseNumber" defaultValue={defaults.text("caseNumber")} placeholder="DEM20260001" />}
        </FormField>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
