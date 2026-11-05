import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DocumentItem } from "@/domain/documents/document-repository";
import { DOCUMENT_CATEGORY_LABELS, formatFileSize } from "@/domain/documents/document-rules";
import { formatDateTime } from "@/domain/shared/time";

import { RemoveDocumentButton } from "./remove-document-button";

export function DocumentTable({ documents, emptyText }: { documents: DocumentItem[]; emptyText: string }) {
  if (documents.length === 0) {
    return <p className="rounded-lg border p-6 text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document.id}>
            <TableCell className="font-medium">
              {/* A plain link: the route redirects to a signed download URL. */}
              <a href={`/documents/${document.id}/download`} className="hover:underline">
                {document.fileName}
              </a>
            </TableCell>
            <TableCell>{DOCUMENT_CATEGORY_LABELS[document.category]}</TableCell>
            <TableCell>{formatFileSize(document.size)}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateTime(document.createdAt)}
              {document.uploadedBy ? ` · ${document.uploadedBy}` : null}
            </TableCell>
            <TableCell className="text-right">
              <RemoveDocumentButton documentId={document.id} fileName={document.fileName} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
