import type { DbClient } from "@/lib/supabase/server";

import type { WriteResult } from "@/domain/shared/repository";

import { DOCUMENT_BUCKET, type DocumentCategory } from "./document-rules";

export type DocumentItem = {
  id: string;
  caseId: string | null;
  fileName: string;
  size: number | null;
  mimeType: string | null;
  category: DocumentCategory;
  createdAt: string;
  uploadedBy: string | null;
};

const DOCUMENT_COLUMNS =
  "id, case_id, file_name, size, mime_type, category, created_at, uploader:app_user!document_created_by_fkey (full_name)";

export function createDocumentRepository(db: DbClient) {
  const storage = db.storage.from(DOCUMENT_BUCKET);

  return {
    /** Documents of a case, or the shared documents when caseId is null. */
    async list(caseId: string | null): Promise<DocumentItem[]> {
      let request = db.from("document").select(DOCUMENT_COLUMNS).order("created_at", { ascending: false });
      request = caseId ? request.eq("case_id", caseId) : request.is("case_id", null);
      const { data, error } = await request;
      if (error) {
        throw new Error(`Could not load documents: ${error.message}`);
      }
      return data.map((row) => ({
        id: row.id,
        caseId: row.case_id,
        fileName: row.file_name,
        size: row.size,
        mimeType: row.mime_type,
        category: row.category,
        createdAt: row.created_at,
        uploadedBy: row.uploader?.full_name ?? null,
      }));
    },

    async getById(id: string): Promise<{ id: string; caseId: string | null; fileName: string; storagePath: string } | null> {
      const { data, error } = await db
        .from("document")
        .select("id, case_id, file_name, storage_path")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the document: ${error.message}`);
      }
      return data
        ? { id: data.id, caseId: data.case_id, fileName: data.file_name, storagePath: data.storage_path }
        : null;
    },

    /** A one-time URL the browser uploads the file to (valid for 2 hours). */
    async createUploadUrl(path: string): Promise<string | null> {
      const { data, error } = await storage.createSignedUploadUrl(path);
      return error ? null : data.signedUrl;
    },

    /** Size and type of a stored file, as Storage recorded them; null if it is not there. */
    async objectInfo(path: string): Promise<{ size: number | null; mimeType: string | null } | null> {
      const { data, error } = await storage.info(path);
      if (error || !data) {
        return null;
      }
      return { size: data.size ?? null, mimeType: data.contentType ?? null };
    },

    async insert(row: {
      id: string;
      caseId: string | null;
      fileName: string;
      size: number | null;
      mimeType: string | null;
      category: DocumentCategory;
      storagePath: string;
    }): Promise<WriteResult> {
      const { data, error } = await db
        .from("document")
        .insert({
          id: row.id,
          case_id: row.caseId,
          file_name: row.fileName,
          size: row.size,
          mime_type: row.mimeType,
          category: row.category,
          storage_path: row.storagePath,
        })
        .select("id")
        .single();
      return error ? { ok: false, error } : { ok: true, id: data.id };
    },

    async delete(id: string): Promise<boolean> {
      const { data, error } = await db.from("document").delete().eq("id", id).select("id");
      if (error) {
        throw new Error(`Could not remove the document: ${error.message}`);
      }
      return data.length > 0;
    },

    async removeObject(path: string): Promise<void> {
      await storage.remove([path]);
    },

    /** A short-lived link that downloads the file under its original name. */
    async downloadUrl(path: string, fileName: string): Promise<string | null> {
      const { data, error } = await storage.createSignedUrl(path, 60, { download: fileName });
      return error ? null : data.signedUrl;
    },
  };
}

export type DocumentRepository = ReturnType<typeof createDocumentRepository>;
