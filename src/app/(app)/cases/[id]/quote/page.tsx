import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getAssessmentService } from "@/domain/assessment";
import { getCaseService } from "@/domain/cases";
import { getQuoteService } from "@/domain/quotes";
import { getVehicleService } from "@/domain/vehicles";

import { saveQuoteAction, validateQuoteAction } from "./actions";
import { CopyToPostButton, MarkSentButton } from "./quote-buttons";
import { QuoteEditor } from "./quote-editor";
import { ValidateDialog } from "./validate-dialog";

export const metadata: Metadata = {
  title: "Quote",
};

/** Quote tab: UC-18 to UC-22. */
export default function QuoteTabPage({ params }: PageProps<"/cases/[id]/quote">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <QuoteTab params={params} />
    </Suspense>
  );
}

async function QuoteTab({ params }: Pick<PageProps<"/cases/[id]/quote">, "params">) {
  const { id } = await params;
  const [cases, quotes, assessments, vehicles] = await Promise.all([
    getCaseService(),
    getQuoteService(),
    getAssessmentService(),
    getVehicleService(),
  ]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const [{ pre, post }, assessment, vehicle] = await Promise.all([
    quotes.getForCase(detail.id),
    assessments.get(detail.id),
    detail.vehicle ? vehicles.get(detail.vehicle.id) : null,
  ]);
  const reportId = assessment?.assessment?.expertReportDocumentId ?? null;
  const reportName = assessment?.expertReports.find((report) => report.id === reportId)?.fileName ?? null;

  // UC-19: vehicle details that are often completed from the estimate.
  const missing = vehicle
    ? [
        vehicle.vin ? null : "VIN",
        vehicle.typeDesignation ? null : "type",
        vehicle.make && vehicle.model ? null : "make and model",
      ].filter(Boolean)
    : ["the vehicle"];

  return (
    <div className="grid gap-6">
      {missing.length > 0 ? (
        <p role="note" className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
          Missing vehicle data: {missing.join(", ")}. Complete it from the estimate on the{" "}
          <Link href={`/cases/${detail.id}/vehicle`} className="underline">
            Vehicle tab
          </Link>{" "}
          (UC-19).
        </p>
      ) : null}

      <QuoteEditor
        title="Pre-calculation"
        quote={pre}
        action={saveQuoteAction.bind(null, detail.id, "pre_calculation")}
        toolbar={
          pre && pre.status === "draft" && pre.lines.length > 0 ? <MarkSentButton caseId={detail.id} /> : null
        }
      />

      <QuoteEditor
        title="Post-calculation"
        quote={post}
        action={saveQuoteAction.bind(null, detail.id, "post_calculation")}
        toolbar={
          post?.status === "validated" ? null : (
            <>
              {pre && pre.lines.length > 0 ? (
                <CopyToPostButton caseId={detail.id} replaces={post?.lines.length ?? 0} />
              ) : null}
              {post && post.lines.length > 0 ? (
                <ValidateDialog
                  action={validateQuoteAction.bind(null, detail.id)}
                  postTotal={post.total}
                  hasExpertReport={Boolean(reportId)}
                  expertReportName={reportName}
                />
              ) : null}
            </>
          )
        }
      />
    </div>
  );
}
