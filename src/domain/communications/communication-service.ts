import { documentStoragePath } from "@/domain/documents/document-rules";
import type { NewDocument } from "@/domain/intake/inbound-repository";
import { isUuid, type FieldErrors } from "@/domain/shared/input";

import {
  parseCommunicationFilter,
  parseComposeInput,
  parseLogInput,
  type ComposeField,
  type LogField,
} from "./communication-input";
import type { CaseDocumentOption, CommunicationRepository, OutboundMessage, Template, TemplateSummary } from "./communication-repository";
import { MAX_ATTACHMENT_BYTES, type EmailTransport } from "./email-transport";
import { buildMergeData, MERGE_FIELD_LABELS, renderTemplate } from "./merge-fields";
import { renderRepairOrderPdf, repairOrderFileName } from "./repair-order-pdf";
import { recipientsFor, REPAIR_ORDER_TEMPLATE, STATUS_HINTS, TEMPLATE_LANGUAGES } from "./templates";

export const SEND_FAILED_MESSAGE = "The e-mail could not be sent. Please try again.";
const MESSAGE_GONE = "This draft no longer exists or has been sent.";

export type MailSettings = {
  /** The From address, e.g. "Go Smart CRM <cases@example.com>". */
  from: string;
  companyName: string;
  /** Where repairers send invoices (BR-09), printed on the repair order. */
  invoicingEmail: string | null;
};

export type ComposeView = {
  message: OutboundMessage;
  documents: CaseDocumentOption[];
  /** Merge fields the template uses that have no value on the case. */
  missing: string[];
  attachRepairOrder: boolean;
  statusHint: string | null;
  delivers: boolean;
};

export type SendOutcome =
  | { ok: true }
  | { ok: false; fieldErrors?: FieldErrors<ComposeField>; formError?: string };

type User = { id: string; fullName: string };

function missingFields(template: { subject: string; body: string } | null, message: OutboundMessage): string[] {
  if (!template) {
    return [];
  }
  const { missing } = renderTemplate(`${template.subject}\n${template.body}`, message.mergeData);
  return missing.map((field) => MERGE_FIELD_LABELS[field] ?? field);
}

/**
 * Communication (UC-13 to UC-15, UC-33, UC-35): the case's log, template
 * e-mails rendered as drafts that a user sends, and logged calls. Only a
 * signed-in user approves and sends (plan.md section 3: agents create drafts).
 */
export function createCommunicationService(deps: {
  repository: CommunicationRepository;
  transport: EmailTransport;
  settings: MailSettings;
  now?: () => Date;
  newId?: () => string;
}) {
  const { repository, transport, settings } = deps;
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => crypto.randomUUID());

  async function draftOf(caseId: string, messageId: string): Promise<OutboundMessage | null> {
    const message = isUuid(caseId) && isUuid(messageId) ? await repository.message(messageId) : null;
    return message && message.caseId === caseId && (message.status === "draft" || message.status === "failed")
      ? message
      : null;
  }

  async function templateOf(message: OutboundMessage): Promise<Template | null> {
    return message.templateCode && message.language ? repository.template(message.templateCode, message.language) : null;
  }

  /** UC-13: the repair order as a PDF, for a preview or an attachment. */
  async function repairOrder(caseId: string): Promise<{ fileName: string; content: Uint8Array } | null> {
    const context = isUuid(caseId) ? await repository.caseContext(caseId) : null;
    if (!context) {
      return null;
    }
    return {
      fileName: repairOrderFileName(context.caseNumber),
      content: await renderRepairOrderPdf(context, {
        issuedAt: now(),
        companyName: settings.companyName,
        invoicingEmail: settings.invoicingEmail,
      }),
    };
  }

  return {
    delivers: transport.delivers,

    list(caseId: string, filter: unknown) {
      return isUuid(caseId) ? repository.list(caseId, parseCommunicationFilter(filter)) : Promise.resolve([]);
    },

    templates(): Promise<TemplateSummary[]> {
      return repository.templates();
    },

    openMessages(caseId: string) {
      return isUuid(caseId) ? repository.openMessages(caseId) : Promise.resolve([]);
    },

    /** UC-35: mark as processed (or not). */
    async setProcessed(caseId: string, communicationId: string, processed: boolean): Promise<boolean> {
      if (!isUuid(caseId) || !isUuid(communicationId) || !(await repository.isOnCase(caseId, communicationId))) {
        return false;
      }
      return repository.setProcessed(communicationId, processed);
    },

    /** UC-35: "Add communication" – a phone call or other contact. */
    async logContact(
      caseId: string,
      input: unknown,
    ): Promise<{ ok: true } | { ok: false; fieldErrors?: FieldErrors<LogField>; formError?: string }> {
      const parsed = parseLogInput(input);
      if (!parsed.ok) {
        return parsed;
      }
      const result = await repository.log(caseId, {
        channel: parsed.value.channel,
        direction: parsed.value.direction,
        subject: parsed.value.subject,
        body: parsed.value.body,
        sent_at: parsed.value.occurredAt ?? now().toISOString(),
      });
      return result.ok ? result : { ok: false, formError: "The communication could not be saved. Please try again." };
    },

    /** UC-33, step 1: the template rendered with the case's data, as a draft. */
    async createDraft(
      caseId: string,
      input: { templateCode?: unknown; language?: unknown },
      user: User,
    ): Promise<{ ok: true; id: string } | { ok: false; formError: string }> {
      const language = (TEMPLATE_LANGUAGES as readonly unknown[]).includes(input.language) ? (input.language as string) : null;
      if (typeof input.templateCode !== "string" || !language) {
        return { ok: false, formError: "Choose a template and a language." };
      }
      const [template, context] = await Promise.all([
        repository.template(input.templateCode, language),
        isUuid(caseId) ? repository.caseContext(caseId) : Promise.resolve(null),
      ]);
      if (!template) {
        return { ok: false, formError: "This template does not exist in that language." };
      }
      if (!context) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const mergeData = buildMergeData(context, { fullName: user.fullName, signature: await repository.userSignature(user.id) });
      const id = await repository.createDraft({
        caseId,
        templateId: template.id,
        mergeData,
        to: recipientsFor(template.audience, context.parties),
        subject: renderTemplate(template.subject, mergeData).text,
        body: renderTemplate(template.body, mergeData).text,
      });
      return { ok: true, id };
    },

    /** The compose screen for a draft. */
    async compose(caseId: string, messageId: string): Promise<ComposeView | null> {
      const message = await draftOf(caseId, messageId);
      if (!message) {
        return null;
      }
      const [template, documents] = await Promise.all([templateOf(message), repository.caseDocuments(caseId)]);
      return {
        message,
        documents,
        missing: missingFields(template, message),
        attachRepairOrder: message.templateCode === REPAIR_ORDER_TEMPLATE,
        statusHint: message.templateCode ? (STATUS_HINTS[message.templateCode] ?? null) : null,
        delivers: transport.delivers,
      };
    },

    async saveDraft(caseId: string, messageId: string, input: Record<string, unknown>): Promise<SendOutcome> {
      const message = await draftOf(caseId, messageId);
      if (!message) {
        return { ok: false, formError: MESSAGE_GONE };
      }
      const parsed = parseComposeInput(input, { sending: false });
      if (!parsed.ok) {
        return parsed;
      }
      const saved = await repository.updateMessage(message.id, ["draft", "failed"], {
        to: parsed.value.to,
        cc: parsed.value.cc,
        subject: parsed.value.subject,
        body: parsed.value.body,
        status: "draft",
      });
      return saved ? { ok: true } : { ok: false, formError: MESSAGE_GONE };
    },

    async discard(caseId: string, messageId: string): Promise<boolean> {
      const message = await draftOf(caseId, messageId);
      return message ? repository.deleteMessage(message.id) : false;
    },

    repairOrder,

    /**
     * UC-33, step 2: the user approves and sends the draft. It is logged on
     * its case and any other cases named (BR-12), with the generated repair
     * order stored as a case document.
     */
    async send(caseId: string, messageId: string, input: Record<string, unknown>, user: User): Promise<SendOutcome> {
      const message = await draftOf(caseId, messageId);
      if (!message) {
        return { ok: false, formError: MESSAGE_GONE };
      }
      const parsed = parseComposeInput(input, { sending: true });
      if (!parsed.ok) {
        return parsed;
      }
      const value = parsed.value;

      const otherCases = await repository.casesByNumbers(value.linkCaseNumbers);
      const unknown = value.linkCaseNumbers.filter((number) => !otherCases.some((match) => match.caseNumber === number));
      if (unknown.length > 0) {
        return { ok: false, fieldErrors: { linkCaseNumbers: [`There is no case ${unknown.join(", ")}.`] } };
      }
      const caseDocuments = await repository.caseDocuments(caseId);
      const chosen = caseDocuments.filter((document) => value.documentIds.includes(document.id));
      if (chosen.length !== value.documentIds.length) {
        return { ok: false, fieldErrors: { documentIds: ["Choose documents of this case."] } };
      }

      const attachments: { fileName: string; mimeType: string; content: Uint8Array }[] = [];
      for (const document of chosen) {
        const content = await repository.readDocument(document.storagePath);
        if (!content) {
          return { ok: false, fieldErrors: { documentIds: [`${document.fileName} could not be read.`] } };
        }
        attachments.push({ fileName: document.fileName, mimeType: document.mimeType ?? "application/octet-stream", content });
      }
      const generated: NewDocument[] = [];
      if (value.attachRepairOrder) {
        const order = await repairOrder(caseId);
        if (!order) {
          return { ok: false, formError: SEND_FAILED_MESSAGE };
        }
        attachments.push({ fileName: order.fileName, mimeType: "application/pdf", content: order.content });
        const id = newId();
        generated.push({
          id,
          fileName: order.fileName,
          size: order.content.byteLength,
          mimeType: "application/pdf",
          category: "repair_order",
          storagePath: documentStoragePath({ caseId, documentId: id, fileName: order.fileName }),
        });
      }
      if (attachments.reduce((total, attachment) => total + attachment.content.byteLength, 0) > MAX_ATTACHMENT_BYTES) {
        return { ok: false, fieldErrors: { documentIds: ["The attachments together must be smaller than 10 MB."] } };
      }

      // The user's approval (plan.md section 3: a human approves what is sent).
      const approved = await repository.updateMessage(message.id, ["draft", "failed"], {
        to: value.to,
        cc: value.cc,
        subject: value.subject,
        body: value.body,
        status: "approved",
        approvedBy: user.id,
      });
      if (!approved) {
        return { ok: false, formError: MESSAGE_GONE };
      }

      const sent = await transport.send({
        from: settings.from,
        to: value.to,
        cc: value.cc,
        bcc: value.bcc,
        subject: value.subject,
        text: value.body,
        attachments,
      });
      if (!sent.ok) {
        await repository.updateMessage(message.id, ["approved"], { status: "failed" });
        return { ok: false, formError: sent.error };
      }

      const stored: NewDocument[] = [];
      for (const [index, document] of generated.entries()) {
        const content = attachments[chosen.length + index].content;
        if (await repository.storeDocument(document.storagePath, content, document.mimeType)) {
          stored.push(document);
        }
      }
      const recorded = await repository.recordSent(
        message.id,
        otherCases.map((match) => match.id),
        {
          channel: "email",
          direction: "out",
          subject: value.subject,
          body: value.body,
          from_address: settings.from,
          to_addresses: value.to,
          cc_addresses: value.cc,
          bcc_addresses: value.bcc,
          sent_at: now().toISOString(),
          // An e-mail the user sent needs no further processing (UC-35).
          processed: true,
          language: message.language,
        },
        stored,
      );
      if (!recorded.ok) {
        await repository.removeDocuments(stored.map((document) => document.storagePath));
        return { ok: false, formError: "The e-mail was sent, but it could not be logged on the case." };
      }
      return { ok: true };
    },
  };
}

export type CommunicationService = ReturnType<typeof createCommunicationService>;
