"use server";

import { refresh } from "next/cache";

import { getTaskService } from "@/domain/tasks";

import { readForm, type FormState } from "../form-state";
import { requireUser } from "../session";

export type TaskFormState = FormState<string>;

/** UC-03: "New" task. */
export async function createTaskAction(previous: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await requireUser();
  const values = readForm(formData);
  const tasks = await getTaskService();
  const result = await tasks.create(values, user.id);
  const version = previous.version + 1;
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, formError: result.formError, values, version };
  }
  refresh();
  return { saved: true, version };
}

export async function setTaskDoneAction(taskId: string, done: boolean): Promise<void> {
  await requireUser();
  const tasks = await getTaskService();
  await tasks.setDone(taskId, done);
  refresh();
}
