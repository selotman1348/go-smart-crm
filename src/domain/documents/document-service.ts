import { isUuid, type FieldErrors } from "@/domain/shared/input";

import {
  DOCUMENT_CATEGORIES,
  documentStoragePath,
  parseUploadRequest,
  type DocumentCategory,
  type UploadField,
} from "./document-rules";
import type { DocumentRepository } from "./document-repository";

export const UPLOAD_FAILED_MESSAGE = "The file could not be uploaded. Please try again.";

export type PreparedUpload = { documentId: string; uploadUrl: string };

export function createDocumentService(repository: DocumentRepository, newId: () => string = () => crypto.randomUUID()) {
  return {
    listForCase(caseId: string) {
      return isUuid(caseId) ? repository.list(caseId) : Promise.resolve([]);
    },

    listShared() {
      return repository.list(null);
    },

    /**
     * UC-36, step 1: checks the file and returns a one-time upload URL. The
     * browser uploads the file straight to Storage, so large photos never
     * pass through the web server.
     */
    async prepareUpload(
      input: unknown,
    ): Promise<{ ok: true; upload: PreparedUpload } | { ok: false; fieldErrors?: FieldErrors<UploadField>; formError?: string }> {
      const parsed = parseUploadRequest(input);
      if (!parsed.ok) {
        return { ok: false, fieldErrors: parsed.fieldErrors };
      }
      const documentId = newId();
      const path = documentStoragePath({ caseId: parsed.value.caseId, documentId, fileName: parsed.value.fileName });
      const uploadUrl = await repository.createUploadUrl(path);
      return uploadUrl ? { ok: true, upload: { documentId, uploadUrl } } : { ok: false, formError: UPLOAD_FAILED_MESSAGE };
    },

    /**
     * UC-36, step 2: registers the uploaded file. Size and type are taken from
     * what Storage received, not from the browser.
     */
    async confirmUpload(input: {
      documentId: unknown;
      caseId: unknown;
      fileName: unknown;
      category: unknown;
    }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
      const caseId = input.caseId === null || input.caseId === "" ? null : input.caseId;
      if (
        !isUuid(input.documentId) ||
        (caseId !== null && !isUuid(caseId)) ||
        typeof input.fileName !== "string" ||
        !(DOCUMENT_CATEGORIES as readonly unknown[]).includes(input.category)
      ) {
        return { ok: false, error: UPLOAD_FAILED_MESSAGE };
      }
      const storagePath = documentStoragePath({ caseId, documentId: input.documentId, fileName: input.fileName });
      const stored = await repository.objectInfo(storagePath);
      if (!stored) {
        return { ok: false, error: "The file did not arrive. Please upload it again." };
      }
      const result = await repository.insert({
        id: input.documentId,
        caseId,
        fileName: input.fileName.trim().slice(0, 255),
        size: stored.size,
        mimeType: stored.mimeType,
        category: input.category as DocumentCategory,
        storagePath,
      });
      if (!result.ok) {
        await repository.removeObject(storagePath);
        return { ok: false, error: UPLOAD_FAILED_MESSAGE };
      }
      return result;
    },

    /** Removes the document; the audit trail keeps a record of it. */
    async remove(documentId: string): Promise<{ ok: true; caseId: string | null } | { ok: false; error: string }> {
      const document = isUuid(documentId) ? await repository.getById(documentId) : null;
      if (!document || !(await repository.delete(document.id))) {
        return { ok: false, error: "This document no longer exists." };
      }
      await repository.removeObject(document.storagePath);
      return { ok: true, caseId: document.caseId };
    },

    async downloadUrl(documentId: string): Promise<string | null> {
      const document = isUuid(documentId) ? await repository.getById(documentId) : null;
      return document ? repository.downloadUrl(document.storagePath, document.fileName) : null;
    },
  };
}

export type DocumentService = ReturnType<typeof createDocumentService>;
