import "server-only";

import { createClient } from "@/lib/supabase/server";

import { isUuid, type FieldErrors } from "@/domain/shared/input";

import { createTaskRepository, type TaskRepository } from "./task-repository";
import { parseTaskInput, type TaskCategory, type TaskField } from "./task-rules";

export type { TaskItem } from "./task-repository";

/** Tasks (UC-03) and their counters on the dashboard (UC-02). */
export function createTaskService(repository: TaskRepository) {
  return {
    list(filter: { category: TaskCategory | null; includeDone: boolean }) {
      return repository.list(filter);
    },

    openCounts() {
      return repository.openCounts();
    },

    async create(
      input: unknown,
      userId: string,
    ): Promise<{ ok: true } | { ok: false; fieldErrors?: FieldErrors<TaskField>; formError?: string }> {
      const parsed = parseTaskInput(input, userId);
      if (!parsed.ok) {
        return parsed;
      }
      const { caseNumber, ...task } = parsed.value;
      const caseId = caseNumber ? await repository.caseIdByNumber(caseNumber) : null;
      if (caseNumber && !caseId) {
        return { ok: false, fieldErrors: { caseNumber: [`There is no case ${caseNumber}.`] } };
      }
      const result = await repository.insert({ ...task, caseId });
      return result.ok ? result : { ok: false, formError: "The task could not be saved. Please try again." };
    },

    setDone(id: string, done: boolean) {
      return isUuid(id) ? repository.setDone(id, done) : Promise.resolve(false);
    },
  };
}

export type TaskService = ReturnType<typeof createTaskService>;

export async function getTaskService(): Promise<TaskService> {
  return createTaskService(createTaskRepository(await createClient()));
}
