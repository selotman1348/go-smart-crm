import type { Database, Json } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/server";

import { DOCUMENT_BUCKET, type DocumentCategory } from "@/domain/documents/document-rules";
import type { RepositoryError } from "@/domain/shared/repository";

export const INBOUND_BUCKET = "inbound";
export const INBOX_PAGE_SIZE = 25;

export type InboundStatus = Database["public"]["Enums"]["inbound_parse_status"];

export type InboxView = "triage" | "all";

export type InboxRow = {
  id: string;
  receivedAt: string;
  from: string | null;
  subject: string | null;
  status: InboundStatus;
  linkedCaseId: string | null;
  linkedCaseNumber: string | null;
  attachmentCount: number;
};

export type InboundAttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  storagePath: string;
};

export type InboundEmailDetail = InboxRow & {
  to: string[];
  cc: string[];
  bodyText: string | null;
  attachments: InboundAttachmentItem[];
};

/** A document row to register with a communication (see insert_communication). */
export type NewDocument = {
  id: string;
  fileName: string;
  size: number;
  mimeType: string;
  category: DocumentCategory;
  storagePath: string;
};

export type NewInboundEmail = {
  id: string;
  messageId: string | null;
  from: string | null;
  to: string[];
  cc: string[];
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  rawStoragePath: string;
};

const LIST_COLUMNS =
  "id, received_at, from_address, subject, parse_status, linked_case_id, linked_case:case!inbound_email_linked_case_id_fkey (case_number), inbound_attachment (count)";

type ListRow = {
  id: string;
  received_at: string;
  from_address: string | null;
  subject: string | null;
  parse_status: InboundStatus;
  linked_case_id: string | null;
  linked_case: { case_number: string } | null;
  inbound_attachment: { count: number }[];
};

function toInboxRow(row: ListRow): InboxRow {
  return {
    id: row.id,
    receivedAt: row.received_at,
    from: row.from_address,
    subject: row.subject,
    status: row.parse_status,
    linkedCaseId: row.linked_case_id,
    linkedCaseNumber: row.linked_case?.case_number ?? null,
    attachmentCount: row.inbound_attachment[0]?.count ?? 0,
  };
}

function documentsJson(documents: NewDocument[]): Json {
  return documents.map((document) => ({
    id: document.id,
    file_name: document.fileName,
    size: document.size,
    mime_type: document.mimeType,
    category: document.category,
    storage_path: document.storagePath,
  }));
}

export function createInboundRepository(db: DbClient) {
  const inbound = db.storage.from(INBOUND_BUCKET);

  return {
    async findByMessageId(messageId: string): Promise<string | null> {
      const { data, error } = await db.from("inbound_email").select("id").eq("message_id", messageId).maybeSingle();
      if (error) {
        throw new Error(`Could not look up the e-mail: ${error.message}`);
      }
      return data?.id ?? null;
    },

    async store(path: string, content: Uint8Array, contentType: string): Promise<boolean> {
      const { error } = await inbound.upload(path, content, { contentType, upsert: false });
      return !error;
    },

    async storeDocument(path: string, content: Uint8Array, contentType: string): Promise<boolean> {
      const { error } = await db.storage.from(DOCUMENT_BUCKET).upload(path, content, { contentType, upsert: false });
      return !error;
    },

    async read(path: string): Promise<Uint8Array | null> {
      const { data, error } = await inbound.download(path);
      return error || !data ? null : new Uint8Array(await data.arrayBuffer());
    },

    async remove(paths: string[]): Promise<void> {
      if (paths.length > 0) {
        await inbound.remove(paths);
      }
    },

    async removeDocuments(paths: string[]): Promise<void> {
      if (paths.length > 0) {
        await db.storage.from(DOCUMENT_BUCKET).remove(paths);
      }
    },

    /** A one-time URL the browser uploads an .eml file to. */
    async createUploadUrl(path: string): Promise<string | null> {
      const { data, error } = await inbound.createSignedUploadUrl(path);
      return error ? null : data.signedUrl;
    },

    async downloadUrl(path: string, fileName: string): Promise<string | null> {
      const { data, error } = await inbound.createSignedUrl(path, 60, { download: fileName });
      return error ? null : data.signedUrl;
    },

    /** Existing cases with these numbers, in the order given. */
    async casesByNumbers(numbers: string[]): Promise<{ id: string; caseNumber: string }[]> {
      if (numbers.length === 0) {
        return [];
      }
      const { data, error } = await db.from("case").select("id, case_number").in("case_number", numbers);
      if (error) {
        throw new Error(`Could not look up the cases: ${error.message}`);
      }
      return numbers.flatMap((number) => {
        const match = data.find((row) => row.case_number === number);
        return match ? [{ id: match.id, caseNumber: match.case_number }] : [];
      });
    },

    async receive(
      email: NewInboundEmail,
      attachments: InboundAttachmentItem[],
      caseIds: string[],
      documents: NewDocument[],
    ): Promise<{ ok: true; id: string; duplicate: boolean } | { ok: false; error: RepositoryError }> {
      const { data, error } = await db
        .rpc("receive_inbound_email", {
          p_email: {
            id: email.id,
            message_id: email.messageId,
            from_address: email.from,
            to_addresses: email.to,
            cc_addresses: email.cc,
            subject: email.subject,
            body_text: email.bodyText,
            body_html: email.bodyHtml,
            received_at: email.receivedAt,
            raw_storage_path: email.rawStoragePath,
          },
          p_attachments: attachments.map((attachment) => ({
            id: attachment.id,
            file_name: attachment.fileName,
            mime_type: attachment.mimeType,
            size: attachment.size,
            storage_path: attachment.storagePath,
          })),
          p_case_ids: caseIds,
          p_documents: documentsJson(documents),
        })
        .single();
      if (error) {
        return { ok: false, error };
      }
      return { ok: true, id: data.id, duplicate: data.duplicate };
    },

    async link(
      emailId: string,
      caseIds: string[],
      converted: boolean,
      documents: NewDocument[],
    ): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.rpc("link_inbound_email", {
        p_email_id: emailId,
        p_case_ids: caseIds,
        p_converted: converted,
        p_documents: documentsJson(documents),
      });
      return error ? { ok: false, error } : { ok: true };
    },

    /** The Inbox: e-mails waiting for triage, or all, newest first. */
    async list(view: InboxView, page: number): Promise<{ rows: InboxRow[]; total: number }> {
      let request = db
        .from("inbound_email")
        .select(LIST_COLUMNS, { count: "exact" })
        .order("received_at", { ascending: false })
        .range((page - 1) * INBOX_PAGE_SIZE, page * INBOX_PAGE_SIZE - 1);
      if (view === "triage") {
        request = request.in("parse_status", ["new", "triage"]);
      }
      const { data, error, count } = await request;
      if (error) {
        throw new Error(`Could not load the Inbox: ${error.message}`);
      }
      return { rows: (data as ListRow[]).map(toInboxRow), total: count ?? 0 };
    },

    async get(id: string): Promise<InboundEmailDetail | null> {
      const { data, error } = await db
        .from("inbound_email")
        .select(
          `${LIST_COLUMNS}, to_addresses, cc_addresses, body_text, attachments:inbound_attachment (id, file_name, mime_type, size, storage_path)`,
        )
        .eq("id", id)
        .order("created_at", { referencedTable: "attachments", ascending: true })
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the e-mail: ${error.message}`);
      }
      if (!data) {
        return null;
      }
      return {
        ...toInboxRow(data as ListRow),
        to: data.to_addresses,
        cc: data.cc_addresses,
        bodyText: data.body_text,
        attachments: data.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.file_name,
          mimeType: attachment.mime_type,
          size: attachment.size,
          storagePath: attachment.storage_path,
        })),
      };
    },

    /** The empty intake draft of "Create case from e-mail" (plan.md 2.1, phase-2 hook). */
    async ensureDraft(emailId: string): Promise<void> {
      const { error } = await db
        .from("intake_draft")
        .upsert({ source_email_id: emailId }, { onConflict: "source_email_id", ignoreDuplicates: true });
      if (error) {
        throw new Error(`Could not create the intake draft: ${error.message}`);
      }
    },
  };
}

export type InboundRepository = ReturnType<typeof createInboundRepository>;
