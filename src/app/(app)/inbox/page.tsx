import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListPagination } from "@/components/list-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getIntakeService, INBOX_PAGE_SIZE, type InboxView } from "@/domain/intake";
import { formatDateTime } from "@/domain/shared/time";
import { cn } from "@/lib/utils";

import { EmlUpload } from "./eml-upload";
import { InboxStatusBadge } from "./inbox-status";

export const metadata: Metadata = {
  title: "Inbox",
};

const VIEWS: { view: InboxView; label: string }[] = [
  { view: "triage", label: "To triage" },
  { view: "all", label: "All e-mails" },
];

/** UC-34: e-mails received at the intake address. */
export default function InboxPage({ searchParams }: PageProps<"/inbox">) {
  return (
    <div className="grid max-w-5xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          E-mails sent or forwarded to the intake address. An e-mail with a case number in its subject is linked to
          that case automatically (BR-10); the others wait here.
        </p>
      </div>
      <EmlUpload />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <InboxList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function InboxList({ searchParams }: Pick<PageProps<"/inbox">, "searchParams">) {
  const params = await searchParams;
  const view: InboxView = params.view === "all" ? "all" : "triage";
  const page = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const intake = await getIntakeService();
  const { rows, total } = await intake.list(view, page);

  return (
    <div className="grid gap-4">
      <nav aria-label="Inbox views" className="flex gap-2">
        {VIEWS.map((item) => (
          <Link
            key={item.view}
            href={item.view === "triage" ? "/inbox" : "/inbox?view=all"}
            aria-current={item.view === view ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm hover:bg-muted",
              item.view === view && "bg-muted font-medium",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          {view === "triage" ? "No e-mails waiting." : "No e-mails received yet."}
        </p>
      ) : (
        <Table aria-label="Inbox">
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="text-right">Attachments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Case</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(row.receivedAt)}</TableCell>
                <TableCell className="max-w-56 truncate">{row.from ?? "—"}</TableCell>
                <TableCell className="max-w-80 truncate">
                  <Link href={`/inbox/${row.id}`} className="font-medium hover:underline">
                    {row.subject ?? "(no subject)"}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.attachmentCount}</TableCell>
                <TableCell>
                  <InboxStatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  {row.linkedCaseId ? (
                    <Link href={`/cases/${row.linkedCaseId}/communications`} className="hover:underline">
                      {row.linkedCaseNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ListPagination
        pathname="/inbox"
        params={{ view: view === "all" ? "all" : undefined }}
        page={page}
        pageCount={Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE))}
        total={total}
        noun={["e-mail", "e-mails"]}
      />
    </div>
  );
}
