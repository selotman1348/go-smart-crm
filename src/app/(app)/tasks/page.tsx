import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { formatDate, zonedDate } from "@/domain/shared/time";
import { getTaskService } from "@/domain/tasks";
import { isOverdue, parseTaskCategory, TASK_CATEGORIES, TASK_CATEGORY_LABELS } from "@/domain/tasks/task-rules";
import { listUserOptions } from "@/domain/users";
import { cn } from "@/lib/utils";

import { createTaskAction, setTaskDoneAction } from "./actions";
import { TaskForm } from "./task-form";

export const metadata: Metadata = {
  title: "Tasks",
};

/** UC-03: tasks by category, "all tasks", and "New". */
export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <div className="grid max-w-5xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Tasks searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Tasks({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const params = await searchParams;
  const category = parseTaskCategory(params.category);
  const includeDone = params.done === "1";
  const [service, users] = await Promise.all([getTaskService(), listUserOptions()]);
  const tasks = await service.list({ category, includeDone });
  const today = zonedDate();
  const href = (next: { category?: string | null; done?: boolean }) => {
    const query = new URLSearchParams();
    const value = next.category === undefined ? category : next.category;
    if (value) {
      query.set("category", value);
    }
    if (next.done ?? includeDone) {
      query.set("done", "1");
    }
    const search = query.toString();
    return search ? `/tasks?${search}` : "/tasks";
  };

  return (
    <>
      <TaskForm
        action={createTaskAction}
        categories={TASK_CATEGORIES.map((value) => ({ value, label: TASK_CATEGORY_LABELS[value] }))}
        users={users.map((user) => ({ value: user.id, label: user.fullName }))}
        defaultCategory={category ?? "my_tasks"}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Task categories" className="flex flex-wrap gap-2">
          {[null, ...TASK_CATEGORIES].map((option) => (
            <Link
              key={option ?? "all"}
              href={href({ category: option })}
              aria-current={option === category ? "page" : undefined}
              className={cn("rounded-md border px-3 py-1.5 text-sm hover:bg-muted", option === category && "bg-muted font-medium")}
            >
              {option ? TASK_CATEGORY_LABELS[option] : "All tasks"}
            </Link>
          ))}
        </nav>
        <Link href={href({ done: !includeDone })} className="text-sm hover:underline">
          {includeDone ? "Hide done tasks" : "Show done tasks"}
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">No open tasks.</p>
      ) : (
        <ul aria-label="Tasks" className="grid gap-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div className="grid gap-0.5">
                <p className={cn("text-sm font-medium", task.done && "text-muted-foreground line-through")}>{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {TASK_CATEGORY_LABELS[task.category]}
                  {task.dueDate ? (
                    <>
                      {" · "}
                      <span className={isOverdue(task, today) ? "font-medium text-destructive" : undefined}>
                        due {formatDate(task.dueDate)}
                        {isOverdue(task, today) ? " (overdue)" : null}
                      </span>
                    </>
                  ) : null}
                  {task.assignee ? ` · ${task.assignee}` : null}
                  {task.caseId ? (
                    <>
                      {" · "}
                      <Link href={`/cases/${task.caseId}`} className="hover:underline">
                        {task.caseNumber}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <form action={setTaskDoneAction.bind(null, task.id, !task.done)}>
                <Button type="submit" variant="outline" size="sm" aria-label={`${task.done ? "Reopen" : "Mark as done"}: ${task.title}`}>
                  {task.done ? "Reopen" : "Mark as done"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
