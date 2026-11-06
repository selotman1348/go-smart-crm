import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCaseService } from "@/domain/cases";
import { getCommunicationService, type CommunicationItem } from "@/domain/communications";
import {
  CHANNEL_LABELS,
  COMMUNICATION_FILTER_LABELS,
  COMMUNICATION_FILTERS,
  DIRECTION_LABELS,
  parseCommunicationFilter,
} from "@/domain/communications/communication-input";
import { LANGUAGE_LABELS, TEMPLATE_LANGUAGES } from "@/domain/communications/templates";
import { formatDateTime } from "@/domain/shared/time";
import { cn } from "@/lib/utils";

import { createDraftAction, logContactAction, setProcessedAction } from "./actions";
import { LogContactForm, NewEmailForm } from "./communication-forms";

export const metadata: Metadata = {
  title: "Communications",
};

/** Communications tab (UC-13 to UC-15, UC-33 to UC-35). */
export default function CommunicationsTabPage({ params, searchParams }: PageProps<"/cases/[id]/communications">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <CommunicationsTab params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CommunicationsTab({
  params,
  searchParams,
}: Pick<PageProps<"/cases/[id]/communications">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [cases, communications] = await Promise.all([getCaseService(), getCommunicationService()]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const filter = parseCommunicationFilter(query.filter);
  const [items, drafts, templates] = await Promise.all([
    communications.list(detail.id, filter),
    communications.openMessages(detail.id),
    communications.templates(),
  ]);
  const templateOptions = templates
    .filter((template) => template.language === "en")
    .map((template) => ({ value: template.code, label: template.name }));
  const base = `/cases/${detail.id}/communications`;

  return (
    <div className="grid gap-8">
      <section aria-labelledby="new-email-title" className="grid gap-3">
        <h2 id="new-email-title" className="text-lg font-semibold">
          New e-mail
        </h2>
        {query.sent ? (
          <p role="status" className="text-sm text-muted-foreground">
            E-mail sent and logged below.
            {communications.delivers ? null : " (Delivery is off in this environment: it was not delivered.)"}
          </p>
        ) : null}
        <NewEmailForm
          action={createDraftAction.bind(null, detail.id)}
          templates={templateOptions}
          languages={TEMPLATE_LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_LABELS[language] }))}
        />
        {drafts.length > 0 ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">Drafts</p>
            <ul className="grid gap-1 text-sm">
              {drafts.map((draft) => (
                <li key={draft.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`${base}/messages/${draft.id}`} className="hover:underline">
                    {draft.subject || "(no subject)"}
                  </Link>
                  <span className="text-muted-foreground">
                    {draft.templateName ?? "No template"} · {formatDateTime(draft.createdAt)}
                  </span>
                  {draft.status === "failed" ? <Badge variant="destructive">Not sent</Badge> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="log-title" className="grid gap-3">
        <h2 id="log-title" className="text-lg font-semibold">
          Communication log
        </h2>
        <nav aria-label="Communication filters" className="flex flex-wrap gap-2">
          {COMMUNICATION_FILTERS.map((option) => (
            <Link
              key={option}
              href={option === "all" ? base : `${base}?filter=${option}`}
              aria-current={option === filter ? "page" : undefined}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm hover:bg-muted",
                option === filter && "bg-muted font-medium",
              )}
            >
              {COMMUNICATION_FILTER_LABELS[option]}
            </Link>
          ))}
        </nav>
        {items.length === 0 ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">No communications yet.</p>
        ) : (
          <ol aria-label="Communications" className="grid gap-3">
            {items.map((item) => (
              <CommunicationEntry key={item.id} caseId={detail.id} item={item} />
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="add-title" className="grid gap-3">
        <h2 id="add-title" className="text-lg font-semibold">
          Log a phone call or other contact
        </h2>
        <LogContactForm action={logContactAction.bind(null, detail.id)} />
      </section>
    </div>
  );
}

function CommunicationEntry({ caseId, item }: { caseId: string; item: CommunicationItem }) {
  const kind =
    item.channel === "email" ? `E-mail ${item.direction === "in" ? "in" : "out"}` : `${CHANNEL_LABELS[item.channel]} (${DIRECTION_LABELS[item.direction].toLowerCase()})`;
  const party = item.direction === "in" ? item.from : item.to.join(", ");

  return (
    <li className="grid gap-2 rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <p className="text-sm">
            <span className="font-medium">{item.subject ?? "(no subject)"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {kind} · {formatDateTime(item.sentAt)}
            {party ? ` · ${item.direction === "in" ? "from" : "to"} ${party}` : null}
            {item.loggedBy ? ` · by ${item.loggedBy}` : null}
            {item.templateName ? ` · template “${item.templateName}”` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={item.processed ? "secondary" : "default"}>{item.processed ? "Processed" : "To process"}</Badge>
          <form action={setProcessedAction.bind(null, caseId, item.id, !item.processed)}>
            <Button type="submit" variant="outline" size="sm" aria-label={`${item.processed ? "Mark as not processed" : "Mark as processed"}: ${item.subject ?? "communication"}`}>
              {item.processed ? "Mark as not processed" : "Mark as processed"}
            </Button>
          </form>
        </div>
      </div>
      {item.body || item.attachments.length > 0 || item.otherCases.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Show message</summary>
          <div className="mt-2 grid gap-2 text-sm">
            {item.cc.length > 0 ? <p className="text-muted-foreground">Cc: {item.cc.join(", ")}</p> : null}
            {item.bcc.length > 0 ? <p className="text-muted-foreground">Bcc: {item.bcc.join(", ")}</p> : null}
            {item.body ? (
              <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 font-sans whitespace-pre-wrap">{item.body}</pre>
            ) : null}
            {item.attachments.length > 0 ? (
              <p>
                Attachments:{" "}
                {item.attachments.map((attachment, index) => (
                  <span key={attachment.id}>
                    {index > 0 ? ", " : null}
                    <a href={`/documents/${attachment.id}/download`} className="hover:underline">
                      {attachment.fileName}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
            {item.otherCases.length > 0 ? (
              <p>
                Also on:{" "}
                {item.otherCases.map((linked, index) => (
                  <span key={linked.id}>
                    {index > 0 ? ", " : null}
                    <Link href={`/cases/${linked.id}/communications`} className="hover:underline">
                      {linked.caseNumber}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
    </li>
  );
}
