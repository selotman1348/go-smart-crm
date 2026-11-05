"use server";

import { refresh } from "next/cache";

import { getDocumentService } from "@/domain/documents";

import { requireUser } from "../session";

type UploadDetails = {
  caseId: string | null;
  fileName: string;
  size: number;
  mimeType: string;
  category: string;
};

export type ActionResult<Data = object> = ({ ok: true } & Data) | { ok: false; error: string };

/** Step 1 of an upload: validates the file and returns a one-time upload URL. */
export async function prepareUploadAction(
  details: UploadDetails,
): Promise<ActionResult<{ documentId: string; uploadUrl: string }>> {
  await requireUser();
  const documents = await getDocumentService();
  const result = await documents.prepareUpload(details);
  if (!result.ok) {
    const fieldError = Object.values(result.fieldErrors ?? {}).flat()[0];
    return { ok: false, error: fieldError ?? result.formError ?? "The file could not be uploaded." };
  }
  return { ok: true, ...result.upload };
}

/**
 * Step 2 of an upload: registers the file the browser uploaded. The upload
 * widget refreshes the page itself once all files are in.
 */
export async function confirmUploadAction(details: {
  documentId: string;
  caseId: string | null;
  fileName: string;
  category: string;
}): Promise<ActionResult> {
  await requireUser();
  const documents = await getDocumentService();
  const result = await documents.confirmUpload(details);
  return result.ok ? { ok: true } : result;
}

export async function removeDocumentAction(documentId: string): Promise<ActionResult> {
  await requireUser();
  const documents = await getDocumentService();
  const result = await documents.remove(documentId);
  if (!result.ok) {
    return result;
  }
  refresh();
  return { ok: true };
}
