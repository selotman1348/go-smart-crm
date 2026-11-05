import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCaseService, warningsForTab } from "@/domain/cases";
import { getLookups } from "@/domain/lookups";
import { isoToZonedLocal } from "@/domain/shared/time";
import { listUserOptions } from "@/domain/users";

import { saveCaseHeaderAction } from "./actions";
import { CaseHeaderForm } from "./case-header-form";

export const metadata: Metadata = {
  title: "Case",
};

/** Case tab: UC-09 header, UC-17 client references, UC-28 on hold, tags. */
export default function CaseTabPage({ params }: PageProps<"/cases/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <CaseTab params={params} />
    </Suspense>
  );
}

async function CaseTab({ params }: Pick<PageProps<"/cases/[id]">, "params">) {
  const { id } = await params;
  const [cases, lookups] = await Promise.all([getCaseService(), getLookups()]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const [users, onHoldReasons, tags] = await Promise.all([
    listUserOptions(),
    lookups.list("on_hold_reason"),
    cases.listTags(),
  ]);
  const { header } = detail;

  return (
    <CaseHeaderForm
      action={saveCaseHeaderAction.bind(null, detail.id)}
      stored={{
        ...header,
        vatLiablePct: header.vatLiablePct?.toString() ?? null,
        deductible: header.deductible?.toString() ?? null,
        appointmentEstimateAt: isoToZonedLocal(header.appointmentEstimateAt),
        appointmentRepairAt: isoToZonedLocal(header.appointmentRepairAt),
        tagIds: detail.tagIds,
      }}
      users={users.map((user) => ({ value: user.id, label: user.fullName }))}
      onHoldReasons={onHoldReasons.map((reason) => ({ value: reason.code, label: reason.label }))}
      tags={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
      warnings={warningsForTab(detail.warnings, "case")}
    />
  );
}
