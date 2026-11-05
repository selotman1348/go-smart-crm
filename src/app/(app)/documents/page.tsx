import type { Metadata } from "next";
import { Suspense } from "react";

import { DocumentTable } from "@/components/documents/document-table";
import { DocumentUpload } from "@/components/documents/document-upload";
import { getDocumentService } from "@/domain/documents";
import { DOCUMENT_CATEGORIES } from "@/domain/documents/document-rules";

export const metadata: Metadata = {
  title: "Documents",
};

/** UC-36: shared documents that do not belong to a case, e.g. the repair-order template. */
export default function DocumentsPage() {
  return (
    <div className="grid max-w-4xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Shared documents that are not part of a case, such as templates. Case documents are on each
          case&apos;s Documents tab.
        </p>
      </div>
      <DocumentUpload caseId={null} categories={[...DOCUMENT_CATEGORIES]} defaultCategory="other" />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading documents…</p>}>
        <SharedDocuments />
      </Suspense>
    </div>
  );
}

async function SharedDocuments() {
  const documents = await getDocumentService();
  return <DocumentTable documents={await documents.listShared()} emptyText="No shared documents yet." />;
}
