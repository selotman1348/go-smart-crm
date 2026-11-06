import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DocumentUpload } from "@/components/documents/document-upload";
import { Button } from "@/components/ui/button";
import { getAssessmentService } from "@/domain/assessment";
import { getCaseService } from "@/domain/cases";
import { getInvoiceService } from "@/domain/invoicing";
import { getLookups } from "@/domain/lookups";
import { EXPERT_APPOINTMENT_TEMPLATE } from "@/domain/communications/templates";
import { ASSESSMENT_TYPE_LABELS } from "@/domain/quotes/validation";
import { formatMoney } from "@/domain/shared/money";
import { formatDateTime } from "@/domain/shared/time";

import { startTemplateEmailAction } from "../communications/actions";
import {
  recordNoRepairAction,
  recordSalesInvoiceAction,
  recordTotalLossAction,
  saveExpertAction,
  saveRepairerInvoiceAction,
} from "./actions";
import { ExpertForm, NoRepairForm, TotalLossForm } from "./assessment-forms";
import { RepairerInvoiceForm, SalesInvoiceForm } from "./invoicing-forms";

export const metadata: Metadata = {
  title: "Assessment",
};

/** Assessment tab: UC-23 to UC-27, and invoicing UC-29 to UC-31. */
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
  const [cases, assessments, lookups, invoices] = await Promise.all([
    getCaseService(),
    getAssessmentService(),
    getLookups(),
    getInvoiceService(),
  ]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const [data, noRepairReasons, invoicing] = await Promise.all([
    assessments.get(detail.id),
    lookups.list("no_repair_reason"),
    invoices.overview(detail.id),
  ]);
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
        {(data?.experts ?? []).length > 0 && !closed ? (
          <form action={startTemplateEmailAction.bind(null, detail.id, EXPERT_APPOINTMENT_TEMPLATE, null)}>
            <Button type="submit" variant="outline">
              Send assessment order
            </Button>
          </form>
        ) : null}
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

      {invoicing && detail.repairDecision !== "total_loss" && detail.repairDecision !== "no_repair" ? (
        <Section id="invoicing-heading" title="Invoicing">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Completeness check (BR-08)</p>
            <ul aria-label="Completeness check" className="grid gap-1 text-sm">
              {invoicing.completeness.map((item) => (
                <li key={item.requirement} className={item.met ? "" : "text-destructive"}>
                  {item.met ? "✓" : "✗"} {item.label}
                  <span className="sr-only">{item.met ? " (present)" : " (missing)"}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Set “Invoicing – other” when the repairer invoice arrives, and “Invoicing – OK” in the status menu once
              everything is present.
            </p>
          </div>

          <div className="grid gap-3">
            <h3 className="font-medium">Repairer invoice (UC-29)</h3>
            {invoicing.expectedAmount !== null ? (
              <p className="text-sm text-muted-foreground">
                Expected: {formatMoney(invoicing.expectedAmount)} (the approved {formatMoney(invoicing.approvedExclVat)}
                {invoicing.repairerDiscountPct ? ` minus the agreed ${invoicing.repairerDiscountPct}% discount` : ""}, BR-09).
              </p>
            ) : null}
            {invoicing.amountMatches === false ? (
              <p role="note" className="rounded-lg border border-amber-500/50 px-3 py-2 text-sm">
                The invoiced amount differs from the expected amount. Send “Invoice – amount incorrect” if it is wrong.
              </p>
            ) : null}
            <RepairerInvoiceForm
              action={saveRepairerInvoiceAction.bind(null, detail.id)}
              documents={invoicing.invoiceDocuments.map((document) => ({ value: document.id, label: document.fileName }))}
              stored={{
                received: invoicing.repairerInvoice?.received ?? false,
                receivedDate: invoicing.repairerInvoice?.receivedDate ?? "",
                invoiceNumber: invoicing.repairerInvoice?.invoiceNumber ?? "",
                amountExclVat: invoicing.repairerInvoice?.amountExclVat?.toFixed(2).replace(".", ",") ?? "",
                documentId: invoicing.repairerInvoice?.documentId ?? "",
              }}
              disabled={closed}
            />
            {!closed ? (
              <>
                <DocumentUpload caseId={detail.id} categories={["invoice"]} defaultCategory="invoice" label="Upload the repairer invoice" />
                <div className="flex flex-wrap gap-2">
                  <form action={startTemplateEmailAction.bind(null, detail.id, "invoice_no_approval", null)}>
                    <Button type="submit" variant="outline" size="sm">
                      E-mail: invoice – no expert report/approval
                    </Button>
                  </form>
                  <form action={startTemplateEmailAction.bind(null, detail.id, "invoice_amount_incorrect", null)}>
                    <Button type="submit" variant="outline" size="sm">
                      E-mail: invoice – amount incorrect
                    </Button>
                  </form>
                </div>
              </>
            ) : null}
          </div>

          <div className="grid gap-3">
            <h3 className="font-medium">Sales invoice (UC-31)</h3>
            {invoicing.salesInvoice ? (
              <Figures
                rows={[
                  ["Sales invoice number", invoicing.salesInvoice.invoiceNumber ?? "—"],
                  ["Amount excl. VAT", formatMoney(invoicing.salesInvoice.amountExclVat) || "—"],
                ]}
              />
            ) : detail.status === "invoicing_ok" ? (
              <SalesInvoiceForm action={recordSalesInvoiceAction.bind(null, detail.id)} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Accounting sends the sales invoice number once the case is “Invoicing – OK”; recording it closes the case.
              </p>
            )}
          </div>
        </Section>
      ) : null}

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
