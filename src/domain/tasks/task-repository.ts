import type { DbClient } from "@/lib/supabase/server";

import type { RepositoryError } from "@/domain/shared/repository";

import type { TaskCategory } from "./task-rules";

export type TaskItem = {
  id: string;
  title: string;
  category: TaskCategory;
  dueDate: string | null;
  done: boolean;
  assignee: string | null;
  caseId: string | null;
  caseNumber: string | null;
};

export function createTaskRepository(db: DbClient) {
  return {
    /** Open tasks first, by due date; done tasks only when asked for. */
    async list(filter: { category: TaskCategory | null; includeDone: boolean }): Promise<TaskItem[]> {
      let request = db
        .from("task")
        .select(
          "id, title, category, due_date, done, assignee:app_user!task_assignee_user_id_fkey (full_name), case:case (id, case_number)",
        )
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter.category) {
        request = request.eq("category", filter.category);
      }
      if (!filter.includeDone) {
        request = request.eq("done", false);
      }
      const { data, error } = await request;
      if (error) {
        throw new Error(`Could not load tasks: ${error.message}`);
      }
      return data.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        dueDate: row.due_date,
        done: row.done,
        assignee: row.assignee?.full_name ?? null,
        caseId: row.case?.id ?? null,
        caseNumber: row.case?.case_number ?? null,
      }));
    },

    /** UC-02: open tasks per category. */
    async openCounts(): Promise<Record<TaskCategory, number>> {
      const { data, error } = await db.from("task").select("category").eq("done", false);
      if (error) {
        throw new Error(`Could not count tasks: ${error.message}`);
      }
      const counts: Record<TaskCategory, number> = { my_tasks: 0, repairer_dealer: 0, fleet_insurer: 0, supplier: 0, broker: 0 };
      for (const row of data) {
        counts[row.category] += 1;
      }
      return counts;
    },

    async caseIdByNumber(caseNumber: string): Promise<string | null> {
      const { data, error } = await db.from("case").select("id").eq("case_number", caseNumber).maybeSingle();
      if (error) {
        throw new Error(`Could not look up the case: ${error.message}`);
      }
      return data?.id ?? null;
    },

    async insert(task: {
      title: string;
      category: TaskCategory;
      dueDate: string | null;
      assigneeUserId: string | null;
      caseId: string | null;
    }): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.from("task").insert({
        title: task.title,
        category: task.category,
        due_date: task.dueDate,
        assignee_user_id: task.assigneeUserId,
        case_id: task.caseId,
      });
      return error ? { ok: false, error } : { ok: true };
    },

    async setDone(id: string, done: boolean): Promise<boolean> {
      const { data, error } = await db.from("task").update({ done }).eq("id", id).select("id").maybeSingle();
      return !error && data !== null;
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
