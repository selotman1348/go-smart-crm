import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";

import { normalizeCaseNumber } from "@/domain/intake/case-number-match";
import { fieldErrorsOf, optionalDate, optionalUuid, requiredText, type FieldErrors } from "@/domain/shared/input";

export type TaskCategory = Database["public"]["Enums"]["task_category"];

/** UC-02 / UC-03: the task categories, in dashboard order. */
export const TASK_CATEGORIES = ["my_tasks", "repairer_dealer", "fleet_insurer", "supplier", "broker"] as const satisfies readonly TaskCategory[];

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  my_tasks: "My tasks",
  repairer_dealer: "Repairer / dealer",
  fleet_insurer: "Fleet / insurer",
  supplier: "Supplier",
  broker: "Broker",
};

export function parseTaskCategory(value: unknown): TaskCategory | null {
  return (TASK_CATEGORIES as readonly unknown[]).includes(value) ? (value as TaskCategory) : null;
}

const taskSchema = z.object({
  title: requiredText("Enter what needs to be done.", 200),
  category: z.enum(TASK_CATEGORIES, { error: "Choose a category." }),
  dueDate: optionalDate,
  assigneeUserId: optionalUuid,
  caseNumber: z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? (normalizeCaseNumber(value) ?? "invalid") : null),
    z.string().regex(/^[A-Z]{2,4}\d{8}$/, { error: "Enter a case number, for example DEM20260001." }).nullable(),
  ),
});

export type TaskInput = z.output<typeof taskSchema>;
export type TaskField = keyof TaskInput;

/** UC-03: a new task. "My tasks" without an assignee is assigned to the creator. */
export function parseTaskInput(
  input: unknown,
  userId: string,
): { ok: true; value: TaskInput } | { ok: false; fieldErrors: FieldErrors<TaskField> } {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const value = parsed.data;
  return {
    ok: true,
    value: { ...value, assigneeUserId: value.assigneeUserId ?? (value.category === "my_tasks" ? userId : null) },
  };
}

/** A task is overdue when its due date is before today (dates as YYYY-MM-DD). */
export function isOverdue(task: { dueDate: string | null; done: boolean }, today: string): boolean {
  return !task.done && task.dueDate !== null && task.dueDate < today;
}
