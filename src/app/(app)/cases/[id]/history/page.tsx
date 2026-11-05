import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCaseHistory } from "@/domain/history";
import { formatDateTime } from "@/domain/shared/time";

export const metadata: Metadata = {
  title: "History",
};

/** History tab (UC-37): all changes on the case, newest first. */
export default function HistoryTabPage({ params }: PageProps<"/cases/[id]/history">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <HistoryTab params={params} />
    </Suspense>
  );
}

async function HistoryTab({ params }: Pick<PageProps<"/cases/[id]/history">, "params">) {
  const { id } = await params;
  const entries = await getCaseHistory(id);
  if (!entries) {
    notFound();
  }
  if (entries.length === 0) {
    return <p className="rounded-lg border p-6 text-sm text-muted-foreground">No changes recorded yet.</p>;
  }
  return (
    <ol className="grid gap-3" aria-label="Case history">
      {entries.map((entry) => (
        <li key={entry.key} className="grid gap-1 rounded-lg border px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{entry.summary}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={entry.at}>{formatDateTime(entry.at)}</time> · {entry.actor}
          </p>
          {entry.changes.length > 0 ? (
            <dl className="mt-1 grid gap-1 text-sm sm:grid-cols-[minmax(10rem,auto)_1fr]">
              {entry.changes.map((change) => (
                <div key={change.label} className="contents">
                  <dt className="text-muted-foreground">{change.label}</dt>
                  <dd>
                    <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                      {change.from}
                    </span>{" "}
                    → {change.to}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
