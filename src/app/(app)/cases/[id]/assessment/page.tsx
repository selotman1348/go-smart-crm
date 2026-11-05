import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DocumentUpload } from "@/components/documents/document-upload";
import { getAssessmentService } from "@/domain/assessment";
import { getCaseService } from "@/domain/cases";
import { getLookups } from "@/domain/lookups";
import { ASSESSMENT_TYPE_LABELS } from "@/domain/quotes/validation";
import { formatMoney } from "@/domain/shared/money";
import { formatDateTime } from "@/domain/shared/time";

import { recordNoRepairAction, recordTotalLossAction, saveExpertAction } from "./actions";
import { ExpertForm, NoRepairForm, TotalLossForm } from "./assessment-forms";

export const metadata: Metadata = {
  title: "Assessment",
};

/** Assessment tab: UC-23 to UC-27. */
export default function AssessmentTabPage({ params }: PageProps<"/cases/[id]/assessment">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AssessmentTab params={params} />
    </Suspense>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 rounded-lg border p-4">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Figures({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-1 text-sm sm:grid-cols-[minmax(12rem,auto)_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

async function AssessmentTab({ params }: Pick<PageProps<"/cases/[id]/assessment">, "params">) {
  const { id } = await params;
  const [cases, assessments, lookups] = await Promise.all([getCaseService(), getAssessmentService(), getLookups()]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const [data, noRepairReasons] = await Promise.all([assessments.get(detail.id), lookups.list("no_repair_reason")]);
  const assessment = data?.assessment ?? null;
  const closed = detail.status === "closed";
  const reasonLabel = noRepairReasons.find((reason) => reason.code === detail.noRepairReason)?.label;

  return (
    <div className="grid gap-6">
      <Section id="expert-heading" title="Expert assessment">
        <ExpertForm
          action={saveExpertAction.bind(null, detail.id)}
          experts={(data?.experts ?? []).map((expert) => ({ value: expert.id, label: expert.name }))}
          reports={(data?.expertReports ?? []).map((report) => ({ value: report.id, label: report.fileName }))}
          stored={{
            expertAccountId: assessment?.expertAccountId ?? "",
            expertReportDocumentId: assessment?.expertReportDocumentId ?? "",
          }}
        />
        <DocumentUpload
          caseId={detail.id}
          categories={["expert_report", "purchase_order"]}
          defaultCategory="expert_report"
          label="Upload the expert report or the client's purchase order"
        />
      </Section>

      <Section id="validation-heading" title="Validation">
        {assessment?.validatedAt ? (
          <Figures
            rows={[
              ["Assessment type", ASSESSMENT_TYPE_LABELS[assessment.assessmentType]],
              ["VAT applicable", assessment.vatApplicable ? "Yes" : "No"],
              ["Approved amount excl. VAT", formatMoney(assessment.approvedAmountExclVat)],
              ["Approved amount incl. VAT", formatMoney(assessment.approvedAmountInclVat)],
              ["Loss-of-use days", assessment.lossOfUseDays?.toString() ?? "—"],
              [
                "Validated",
                `${formatDateTime(assessment.validatedAt)}${assessment.validatedBy ? ` by ${assessment.validatedBy}` : ""}`,
              ],
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Not validated yet. Validate the post-calculation on the{" "}
            <Link href={`/cases/${detail.id}/quote`} className="underline">
              Quote tab
            </Link>
            .
          </p>
        )}
      </Section>

      {detail.repairDecision === "total_loss" ? (
        <Section id="total-loss-heading" title="Total loss">
          <Figures
            rows={[
              ["Vehicle value before the incident", formatMoney(assessment?.totalLossVehicleValue)],
              ["Deduction for previous damage", formatMoney(assessment?.totalLossPreviousDamageDeduction) || "—"],
              ["Accessories", formatMoney(assessment?.totalLossAccessories) || "—"],
              ["Wreck value", formatMoney(assessment?.totalLossWreckValue) || "—"],
              ["Total damage amount", formatMoney(assessment?.totalLossDamageAmount)],
            ]}
          />
        </Section>
      ) : null}

      {detail.repairDecision === "no_repair" ? (
        <Section id="no-repair-heading" title="No repair">
          <Figures rows={[["Reason", reasonLabel ?? "—"], ["Note", detail.noRepairReasonText ?? "—"]]} />
        </Section>
      ) : null}

      {!closed && detail.repairDecision !== "total_loss" && detail.repairDecision !== "no_repair" ? (
        <>
          <Section id="total-loss-heading" title="Total loss (UC-26)">
            <TotalLossForm action={recordTotalLossAction.bind(null, detail.id)} disabled={closed} />
          </Section>
          <Section id="no-repair-heading" title="No repair (UC-27)">
            <NoRepairForm
              action={recordNoRepairAction.bind(null, detail.id)}
              reasons={noRepairReasons.map((reason) => ({ value: reason.code, label: reason.label }))}
              disabled={closed}
            />
          </Section>
        </>
      ) : null}
    </div>
  );
}
