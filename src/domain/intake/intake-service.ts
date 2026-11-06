import {
  ALLOWED_DOCUMENT_TYPES,
  documentStoragePath,
  MAX_DOCUMENT_BYTES,
  sanitizeFileName,
  type DocumentCategory,
} from "@/domain/documents/document-rules";
import { isUuid } from "@/domain/shared/input";

import { caseNumbersInSubject, normalizeCaseNumber } from "./case-number-match";
import { bodyText, fromEml, type InboundMessage } from "./inbound-message";
import type {
  InboundAttachmentItem,
  InboundRepository,
  InboxView,
  NewDocument,
} from "./inbound-repository";

export const MAX_EML_BYTES = 25 * 1024 * 1024;
export const INTAKE_FAILED_MESSAGE = "The e-mail could not be stored. Please try again.";
const HANDLED_MESSAGE = "This e-mail has been handled in the meantime.";

export type ReceiveResult =
  | { ok: true; id: string; duplicate: boolean; linkedCaseNumbers: string[] }
  | { ok: false; error: string };

/** Images become photos; other document types are filed as "other". */
export function documentCategoryFor(mimeType: string): DocumentCategory {
  return mimeType.startsWith("image/") ? "photo" : "other";
}

/** Whether an attachment can become a case document (the documents bucket's types and size). */
export function isDocumentAttachment(attachment: { mimeType: string | null; size: number | null }): boolean {
  return (
    attachment.mimeType !== null &&
    attachment.mimeType in ALLOWED_DOCUMENT_TYPES &&
    attachment.size !== null &&
    attachment.size <= MAX_DOCUMENT_BYTES
  );
}

/**
 * E-mail intake (plan.md 2.1, UC-34): stores what arrives, links it to the
 * case whose number is in the subject (BR-10) or leaves it in the Inbox, and
 * handles the Inbox actions. The webhook uses it with the service role; the
 * Inbox with the signed-in user.
 */
export function createIntakeService(repository: InboundRepository, newId: () => string = () => crypto.randomUUID()) {
  /** Copies the attachments that can be documents to the case (documents bucket). */
  async function copyToCase(
    caseId: string,
    attachments: InboundAttachmentItem[],
    content: (attachment: InboundAttachmentItem) => Promise<Uint8Array | null>,
  ): Promise<NewDocument[]> {
    const documents: NewDocument[] = [];
    for (const attachment of attachments.filter(isDocumentAttachment)) {
      const bytes = await content(attachment);
      const mimeType = attachment.mimeType as string;
      const id = newId();
      const storagePath = documentStoragePath({ caseId, documentId: id, fileName: attachment.fileName });
      if (bytes && (await repository.storeDocument(storagePath, bytes, mimeType))) {
        documents.push({
          id,
          fileName: attachment.fileName.slice(0, 255),
          size: bytes.byteLength,
          mimeType,
          category: documentCategoryFor(mimeType),
          storagePath,
        });
      }
    }
    return documents;
  }

  async function receive(
    message: InboundMessage,
    raw: { content: Uint8Array; extension: "eml" | "json"; stored?: boolean },
    emailId: string = newId(),
  ): Promise<ReceiveResult> {
    const rawPath = `${emailId}/raw.${raw.extension}`;
    if (message.messageId) {
      const existing = await repository.findByMessageId(message.messageId);
      if (existing) {
        if (raw.stored) {
          await repository.remove([rawPath]);
        }
        return { ok: true, id: existing, duplicate: true, linkedCaseNumbers: [] };
      }
    }
    const stored: string[] = [];
    if (!raw.stored) {
      if (!(await repository.store(rawPath, raw.content, raw.extension === "eml" ? "message/rfc822" : "application/json"))) {
        return { ok: false, error: INTAKE_FAILED_MESSAGE };
      }
    }
    stored.push(rawPath);

    const attachments: InboundAttachmentItem[] = [];
    const contents = new Map<string, Uint8Array>();
    for (const attachment of message.attachments) {
      const id = newId();
      const storagePath = `${emailId}/${id}/${sanitizeFileName(attachment.fileName)}`;
      if (!(await repository.store(storagePath, attachment.content, attachment.mimeType))) {
        await repository.remove(stored);
        return { ok: false, error: INTAKE_FAILED_MESSAGE };
      }
      stored.push(storagePath);
      attachments.push({
        id,
        fileName: attachment.fileName.slice(0, 255),
        mimeType: attachment.mimeType,
        size: attachment.content.byteLength,
        storagePath,
      });
      contents.set(id, attachment.content);
    }

    // BR-10: only a case number in the subject links the e-mail.
    const cases = await repository.casesByNumbers(caseNumbersInSubject(message.subject));
    const documents =
      cases.length > 0 ? await copyToCase(cases[0].id, attachments, async (attachment) => contents.get(attachment.id) ?? null) : [];

    const result = await repository.receive(
      {
        id: emailId,
        messageId: message.messageId,
        from: message.from,
        to: message.to,
        cc: message.cc,
        subject: message.subject,
        bodyText: bodyText(message),
        bodyHtml: message.html,
        receivedAt: message.receivedAt ?? new Date().toISOString(),
        rawStoragePath: rawPath,
      },
      attachments,
      cases.map((match) => match.id),
      documents,
    );
    if (!result.ok) {
      await repository.remove(stored);
      await repository.removeDocuments(documents.map((document) => document.storagePath));
      return { ok: false, error: INTAKE_FAILED_MESSAGE };
    }
    if (result.duplicate) {
      // Another delivery of the same message won the race.
      await repository.remove(stored);
      await repository.removeDocuments(documents.map((document) => document.storagePath));
    }
    return {
      ok: true,
      id: result.id,
      duplicate: result.duplicate,
      linkedCaseNumbers: result.duplicate ? [] : cases.map((match) => match.caseNumber),
    };
  }

  /** Links a waiting e-mail to cases: "Link to case", or the case created from it. */
  async function linkTo(emailId: string, caseIds: string[], converted: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
    const email = isUuid(emailId) ? await repository.get(emailId) : null;
    if (!email) {
      return { ok: false, error: "This e-mail no longer exists." };
    }
    if (email.status !== "new" && email.status !== "triage") {
      return { ok: false, error: HANDLED_MESSAGE };
    }
    const documents = await copyToCase(caseIds[0], email.attachments, (attachment) => repository.read(attachment.storagePath));
    const result = await repository.link(emailId, caseIds, converted, documents);
    if (!result.ok) {
      await repository.removeDocuments(documents.map((document) => document.storagePath));
      return { ok: false, error: result.error.code === "PT409" ? HANDLED_MESSAGE : INTAKE_FAILED_MESSAGE };
    }
    return { ok: true };
  }

  return {
    receive,

    list(view: InboxView, page: number) {
      return repository.list(view, page);
    },

    get(id: string) {
      return isUuid(id) ? repository.get(id) : Promise.resolve(null);
    },

    async attachmentUrl(emailId: string, attachmentId: string): Promise<string | null> {
      const email = isUuid(emailId) ? await repository.get(emailId) : null;
      const attachment = email?.attachments.find((item) => item.id === attachmentId);
      return attachment ? repository.downloadUrl(attachment.storagePath, attachment.fileName) : null;
    },

    /** "Upload .eml", step 1: a one-time upload URL for the raw e-mail. */
    async prepareEmlUpload(input: { fileName?: unknown; size?: unknown }): Promise<
      { ok: true; emailId: string; uploadUrl: string } | { ok: false; error: string }
    > {
      if (typeof input.fileName !== "string" || !/\.eml$/i.test(input.fileName)) {
        return { ok: false, error: "Choose an .eml file." };
      }
      if (typeof input.size !== "number" || input.size <= 0 || input.size > MAX_EML_BYTES) {
        return { ok: false, error: "The file must be smaller than 25 MB." };
      }
      const emailId = newId();
      const uploadUrl = await repository.createUploadUrl(`${emailId}/raw.eml`);
      return uploadUrl ? { ok: true, emailId, uploadUrl } : { ok: false, error: INTAKE_FAILED_MESSAGE };
    },

    /** "Upload .eml", step 2: the uploaded e-mail goes through the same pipeline as the webhook. */
    async processUploadedEml(emailId: string): Promise<ReceiveResult> {
      if (!isUuid(emailId)) {
        return { ok: false, error: INTAKE_FAILED_MESSAGE };
      }
      const rawPath = `${emailId}/raw.eml`;
      const content = await repository.read(rawPath);
      if (!content) {
        return { ok: false, error: "The file did not arrive. Please upload it again." };
      }
      let message: InboundMessage;
      try {
        message = await fromEml(content);
      } catch {
        await repository.remove([rawPath]);
        return { ok: false, error: "This file could not be read as an e-mail." };
      }
      return receive(message, { content, extension: "eml", stored: true }, emailId);
    },

    /** "Link to case" in the Inbox. */
    async link(emailId: string, caseNumberInput: unknown): Promise<{ ok: true; caseId: string } | { ok: false; error: string }> {
      const caseNumber = normalizeCaseNumber(caseNumberInput);
      if (!caseNumber) {
        return { ok: false, error: "Enter a case number, for example DEM20260001." };
      }
      const [match] = await repository.casesByNumbers([caseNumber]);
      if (!match) {
        return { ok: false, error: `There is no case ${caseNumber}.` };
      }
      const result = await linkTo(emailId, [match.id], false);
      return result.ok ? { ok: true, caseId: match.id } : result;
    },

    /** "Create case from e-mail", step 1: the empty intake draft for this e-mail. */
    async prepareConversion(emailId: string): Promise<{ ok: true } | { ok: false; error: string }> {
      const email = isUuid(emailId) ? await repository.get(emailId) : null;
      if (!email) {
        return { ok: false, error: "This e-mail no longer exists." };
      }
      if (email.status !== "new" && email.status !== "triage") {
        return { ok: false, error: HANDLED_MESSAGE };
      }
      await repository.ensureDraft(emailId);
      return { ok: true };
    },

    /** "Create case from e-mail", step 2: the new case takes over the e-mail. */
    convert(emailId: string, caseId: string) {
      return linkTo(emailId, [caseId], true);
    },
  };
}

export type IntakeService = ReturnType<typeof createIntakeService>;
