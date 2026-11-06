import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createTaskRepository } from "@/domain/tasks/task-repository";

import { createDashboardRepository } from "./dashboard-repository";
import { average, countPerMonth, linearTrend, trendDirection } from "./trends";

export type { HookCounts } from "./dashboard-repository";
export type { PeriodCount } from "./trends";

/** UC-02: open tasks per category, new cases per month with average and trend, and the phase-2 hooks. */
export async function getDashboard(at?: Date) {
  // The client marks the request as dynamic, so the current time is read at request time.
  const db = await createClient();
  const now = at ?? new Date();
  const dashboard = createDashboardRepository(db);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const [taskCounts, dates, hooks] = await Promise.all([
    createTaskRepository(db).openCounts(),
    dashboard.caseCreationDates(since),
    dashboard.hookCounts(),
  ]);
  const perMonth = countPerMonth(dates, now);
  const counts = perMonth.map((item) => item.count);
  const trend = linearTrend(counts);
  return {
    taskCounts,
    newCases: { perMonth, average: average(counts), trend, direction: trendDirection(trend) },
    hooks,
  };
}
