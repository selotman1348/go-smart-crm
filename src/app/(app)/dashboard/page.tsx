import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboard } from "@/domain/dashboard";
import { TASK_CATEGORIES, TASK_CATEGORY_LABELS } from "@/domain/tasks/task-rules";

import { NewCasesChart } from "./new-cases-chart";

export const metadata: Metadata = {
  title: "Dashboard",
};

/** UC-02: open tasks by category, new cases per month and the phase-2 hooks. */
export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

const DIRECTION_TEXT = { rising: "rising", falling: "falling", flat: "about level" } as const;

async function Dashboard() {
  const { taskCounts, newCases, hooks } = await getDashboard();
  const totalTasks = Object.values(taskCounts).reduce((sum, count) => sum + count, 0);

  return (
    <>
      <section aria-labelledby="tasks-title" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tasks-title" className="text-lg font-semibold">
            Open tasks
          </h2>
          <Link href="/tasks" className="text-sm hover:underline">
            All tasks ({totalTasks})
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TASK_CATEGORIES.map((category) => (
            <li key={category}>
              <Link
                href={`/tasks?category=${category}`}
                className="grid gap-1 rounded-lg border p-4 hover:bg-muted"
                aria-label={`${TASK_CATEGORY_LABELS[category]}: ${taskCounts[category]} open`}
              >
                <span className="text-sm text-muted-foreground">{TASK_CATEGORY_LABELS[category]}</span>
                <span className="text-2xl font-semibold tabular-nums">{taskCounts[category]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>New cases per month</CardTitle>
            <CardDescription>
              Last 12 months: {newCases.perMonth.reduce((sum, item) => sum + item.count, 0)} cases, on average{" "}
              {newCases.average.toFixed(1)} per month; the trend is {DIRECTION_TEXT[newCases.direction]}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewCasesChart perMonth={newCases.perMonth} average={newCases.average} trend={newCases.trend} />
          </CardContent>
        </Card>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead generation</CardTitle>
              <CardDescription>
                Leads are not recorded in version 1 (placeholder page), so there is nothing to chart yet.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ready for phase 2</CardTitle>
              <CardDescription>Draft and hook tables that agents will use (plan.md section 3).</CardDescription>
            </CardHeader>
            <CardContent>
              <dl aria-label="Phase-2 hooks" className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Intake drafts to review</dt>
                <dd className="text-right tabular-nums">{hooks.intakeDrafts}</dd>
                <dt className="text-muted-foreground">E-mail drafts</dt>
                <dd className="text-right tabular-nums">{hooks.outboundDrafts}</dd>
                <dt className="text-muted-foreground">Events not yet delivered</dt>
                <dd className="text-right tabular-nums">{hooks.undeliveredEvents}</dd>
                <dt className="text-muted-foreground">Active API clients</dt>
                <dd className="text-right tabular-nums">{hooks.activeApiClients}</dd>
                <dt className="text-muted-foreground">Completeness rules</dt>
                <dd className="text-right tabular-nums">{hooks.completenessRules}</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
