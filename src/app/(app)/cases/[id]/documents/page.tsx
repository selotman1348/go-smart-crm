import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DocumentTable } from "@/components/documents/document-table";
import { DocumentUpload } from "@/components/documents/document-upload";
import { getCaseService } from "@/domain/cases";
import { getDocumentService } from "@/domain/documents";
import { DOCUMENT_CATEGORIES } from "@/domain/documents/document-rules";

export const metadata: Metadata = {
  title: "Documents",
};

/** Documents tab (UC-36). */
export default function DocumentsTabPage({ params }: PageProps<"/cases/[id]/documents">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <DocumentsTab params={params} />
    </Suspense>
  );
}

async function DocumentsTab({ params }: Pick<PageProps<"/cases/[id]/documents">, "params">) {
  const { id } = await params;
  const [cases, documents] = await Promise.all([getCaseService(), getDocumentService()]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  return (
    <div className="grid gap-6">
      <DocumentUpload caseId={detail.id} categories={[...DOCUMENT_CATEGORIES]} defaultCategory="other" />
      <DocumentTable documents={await documents.listForCase(detail.id)} emptyText="No documents yet." />
    </div>
  );
}
