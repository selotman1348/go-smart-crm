import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";

import { fieldErrorsOf, optionalUuid, type FieldErrors } from "@/domain/shared/input";

export type DocumentCategory = Database["public"]["Enums"]["document_category"];

export const DOCUMENT_CATEGORIES = [
  "claim_form",
  "photo",
  "estimate",
  "expert_report",
  "invoice",
  "repair_order",
  "purchase_order",
  "generated",
  "other",
] as const satisfies readonly DocumentCategory[];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  claim_form: "Claim form",
  photo: "Photo",
  estimate: "Estimate",
  expert_report: "Expert report",
  invoice: "Invoice",
  repair_order: "Repair order",
  purchase_order: "Purchase order",
  generated: "Generated",
  other: "Other",
};

export const DOCUMENT_BUCKET = "documents";
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** Keep in step with the bucket's allowed_mime_types (migration 20261105200000). */
export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
  "image/webp": "WebP image",
  "image/heic": "HEIC image",
  "image/heif": "HEIF image",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/vnd.ms-excel": "Excel workbook",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel workbook",
  "message/rfc822": "E-mail (.eml)",
  "text/plain": "Text file",
};

/** For the file picker's `accept` attribute. */
export const DOCUMENT_ACCEPT = Object.keys(ALLOWED_DOCUMENT_TYPES).join(",");

/**
 * A storage-safe file name: no folders, accents or special characters, at
 * most 100 characters, extension kept. "Schade foto’s (1).JPG" -> "Schade-foto-s-1.JPG".
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const plain = base.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const dot = plain.lastIndexOf(".");
  const stem = dot > 0 ? plain.slice(0, dot) : plain;
  const extension = dot > 0 ? plain.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) : "";
  const cleanStem = stem.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const safeStem = (cleanStem || "document").slice(0, 100 - (extension ? extension.length + 1 : 0));
  return extension ? `${safeStem}.${extension}` : safeStem;
}

/** cases/<case>/<document>/<file> for case documents, shared/<document>/<file> otherwise (UC-36). */
export function documentStoragePath(input: {
  caseId: string | null;
  documentId: string;
  fileName: string;
}): string {
  const file = sanitizeFileName(input.fileName);
  return input.caseId
    ? `cases/${input.caseId}/${input.documentId}/${file}`
    : `shared/${input.documentId}/${file}`;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const uploadRequestSchema = z.object({
  caseId: optionalUuid,
  fileName: z
    .string({ error: "Choose a file." })
    .trim()
    .min(1, { error: "Choose a file." })
    .max(255, { error: "The file name is too long." }),
  size: z
    .number({ error: "Choose a file." })
    .int()
    .min(1, { error: "The file is empty." })
    .max(MAX_DOCUMENT_BYTES, { error: "The file is larger than 20 MB." }),
  mimeType: z
    .string()
    .refine((type) => type in ALLOWED_DOCUMENT_TYPES, {
      error: "This file type is not allowed. Use PDF, images, Word, Excel, e-mail or text files.",
    }),
  category: z.enum(DOCUMENT_CATEGORIES, { error: "Choose a category." }),
});

export type UploadRequest = z.output<typeof uploadRequestSchema>;
export type UploadField = keyof UploadRequest;

/** Validates an upload before Storage issues an upload URL. */
export function parseUploadRequest(
  input: unknown,
): { ok: true; value: UploadRequest } | { ok: false; fieldErrors: FieldErrors<UploadField> } {
  const result = uploadRequestSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, fieldErrors: fieldErrorsOf<UploadField>(result.error) };
}
