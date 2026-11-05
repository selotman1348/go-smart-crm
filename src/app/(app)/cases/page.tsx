import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { CaseStatusBadge } from "@/components/case-status-badge";
import { ListPagination } from "@/components/list-pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccountService } from "@/domain/accounts";
import { CASE_STATUS_LABELS, CASE_STATUSES, getCaseService, type ClientTile } from "@/domain/cases";
import {
  CASE_DATE_FILTERS,
  caseListParams,
  hasDateFilter,
  OPEN_STATUS_FILTER,
  parseCaseListQuery,
  type CaseListQuery,
} from "@/domain/cases/case-list-query";
import { formatDate } from "@/domain/shared/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cases",
};

export default function CasesPage({ searchParams }: PageProps<"/cases">) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <Link href="/cases/new" className={buttonVariants()}>
          New case
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading cases…</p>}>
        <CaseList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CaseList({ searchParams }: Pick<PageProps<"/cases">, "searchParams">) {
  const query = parseCaseListQuery(await searchParams);
  const [cases, accounts] = await Promise.all([getCaseService(), getAccountService()]);
  const [result, tiles, clients, repairers] = await Promise.all([
    cases.list(query),
    cases.clientTiles(),
    accounts.listOptions("client"),
    accounts.listOptions("repairer"),
  ]);
  const filtered = Object.values(caseListParams(query)).some(Boolean);

  return (
    <div className="grid gap-6">
      <ClientTiles tiles={tiles} query={query} />

      <Form
        action="/cases"
        role="search"
        key={JSON.stringify(caseListParams(query))}
        className="grid gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            name="q"
            type="search"
            defaultValue={query.search}
            placeholder="Case number, plate, client or reference"
            aria-label="Search cases"
            className="w-72"
          />
          <NativeSelect name="status" defaultValue={query.status ?? ""} aria-label="Status">
            <NativeSelectOption value="">All statuses</NativeSelectOption>
            <NativeSelectOption value={OPEN_STATUS_FILTER}>Open (not closed)</NativeSelectOption>
            {CASE_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {CASE_STATUS_LABELS[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="client" defaultValue={query.clientId ?? ""} aria-label="Client">
            <NativeSelectOption value="">All clients</NativeSelectOption>
            {clients.map((client) => (
              <NativeSelectOption key={client.id} value={client.id}>
                {client.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="repairer" defaultValue={query.repairerId ?? ""} aria-label="Repairer">
            <NativeSelectOption value="">All repairers</NativeSelectOption>
            {repairers.map((repairer) => (
              <NativeSelectOption key={repairer.id} value={repairer.id}>
                {repairer.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {filtered ? (
            <Link href="/cases" className={buttonVariants({ variant: "ghost" })}>
              Reset filters
            </Link>
          ) : null}
        </div>
        <details open={hasDateFilter(query)} className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground">More filters</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CASE_DATE_FILTERS.map(({ key, label }) => (
              <fieldset key={key} className="grid gap-2">
                <legend className="text-sm font-medium">{label}</legend>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`${key}From`} className="sr-only">
                    {label} from
                  </Label>
                  <Input id={`${key}From`} name={`${key}From`} type="date" defaultValue={query[`${key}From`]} />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Label htmlFor={`${key}To`} className="sr-only">
                    {label} to
                  </Label>
                  <Input id={`${key}To`} name={`${key}To`} type="date" defaultValue={query[`${key}To`]} />
                </div>
              </fieldset>
            ))}
          </div>
        </details>
      </Form>

      {result.items.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          {filtered ? "No cases match your search." : "No cases yet."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Licence plate</TableHead>
              <TableHead>Case number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Damage date</TableHead>
              <TableHead>Assignment date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.licencePlate}</TableCell>
                <TableCell className="font-medium">
                  <Link href={`/cases/${item.id}`} className="font-mono hover:underline">
                    {item.caseNumber}
                  </Link>
                </TableCell>
                <TableCell>{item.clientName}</TableCell>
                <TableCell>{item.managerName}</TableCell>
                <TableCell>
                  <CaseStatusBadge status={item.status} onHold={item.onHold} />
                </TableCell>
                <TableCell>{formatDate(item.damageDate)}</TableCell>
                <TableCell>{formatDate(item.assignmentDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ListPagination
        pathname="/cases"
        params={caseListParams(query)}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun={["case", "cases"]}
      />
    </div>
  );
}

/** UC-04: open cases per client, plus the total. A tile shows that client's open cases. */
function ClientTiles({ tiles, query }: { tiles: ClientTile[]; query: CaseListQuery }) {
  const total = tiles.reduce((sum, tile) => sum + tile.openCases, 0);
  const allActive = query.status === OPEN_STATUS_FILTER && !query.clientId;
  const tileClass = (active: boolean) =>
    cn(
      "grid min-w-36 gap-1 rounded-lg border px-4 py-3 text-left hover:bg-muted",
      active && "border-primary bg-muted",
    );

  return (
    <nav aria-label="Open cases per client" className="flex flex-wrap gap-3">
      <Link
        href={`/cases?status=${OPEN_STATUS_FILTER}`}
        className={tileClass(allActive)}
        aria-current={allActive ? "true" : undefined}
      >
        <span className="text-2xl font-semibold tabular-nums">{total}</span>
        <span className="text-sm text-muted-foreground">All open cases</span>
      </Link>
      {tiles.map((tile) => {
        const active = query.status === OPEN_STATUS_FILTER && query.clientId === tile.clientAccountId;
        return (
          <Link
            key={tile.clientAccountId}
            href={`/cases?status=${OPEN_STATUS_FILTER}&client=${tile.clientAccountId}`}
            className={tileClass(active)}
            aria-current={active ? "true" : undefined}
          >
            <span className="text-2xl font-semibold tabular-nums">{tile.openCases}</span>
            <span className="text-sm text-muted-foreground">{tile.clientName}</span>
          </Link>
        );
      })}
    </nav>
  );
}
