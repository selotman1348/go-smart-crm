import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CaseStatusBadge } from "@/components/case-status-badge";
import { getCaseService } from "@/domain/cases";

import { changeStatusAction } from "./actions";
import { CaseTabLinks, CaseTabs } from "./case-tabs";
import { StatusControl } from "./status-control";

export default function CaseLayout({ children, params }: LayoutProps<"/cases/[id]">) {
  return (
    <div className="grid max-w-5xl gap-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading case…</p>}>
        <CaseHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function CaseHeader({ params }: Pick<LayoutProps<"/cases/[id]">, "params">) {
  const { id } = await params;
  const cases = await getCaseService();
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const warningTabs = [...new Set(detail.warnings.map((warning) => warning.tab))];
  const vehicle = detail.vehicle
    ? [detail.vehicle.licencePlate, [detail.vehicle.make, detail.vehicle.model].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" · ")
    : "No vehicle yet";

  return (
    <header className="grid gap-4">
      <div className="grid gap-1">
        <Link href="/cases" className="text-sm text-muted-foreground hover:underline">
          Cases
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{detail.caseNumber}</h1>
          <CaseStatusBadge status={detail.status} onHold={detail.onHold} />
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/accounts/${detail.client.id}`} className="hover:underline">
            {detail.client.name}
          </Link>
          {" · "}
          {vehicle}
        </p>
      </div>
      <StatusControl action={changeStatusAction.bind(null, detail.id)} status={detail.status} />
      <Suspense fallback={<CaseTabLinks caseId={detail.id} pathname={null} warningTabs={warningTabs} />}>
        <CaseTabs caseId={detail.id} warningTabs={warningTabs} />
      </Suspense>
    </header>
  );
}
