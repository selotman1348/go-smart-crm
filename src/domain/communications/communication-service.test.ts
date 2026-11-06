import { describe, expect, it } from "vitest";

import type { CommunicationRepository, OutboundMessage, Template } from "./communication-repository";
import { createCommunicationService } from "./communication-service";
import type { EmailTransport, OutgoingEmail } from "./email-transport";
import { context } from "./test-context";

const CASE_ID = context.caseId;
const MESSAGE_ID = "55555555-5555-4555-8555-555555555555";
const DOCUMENT_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_CASE = "77777777-7777-4777-8777-777777777777";
const USER = { id: "11111111-1111-4111-8111-111111111111", fullName: "Alex Morgan" };

const template: Template = {
  id: "t1",
  code: "new_repair_order",
  name: "New repair order",
  language: "en",
  audience: "repairer",
  subject: "New repair order {{case.number}}",
  body: "Dear {{repairer.name}}, VIN {{vehicle.vin}}. {{user.fullName}}",
};

function setup(options: { transport?: EmailTransport; message?: Partial<OutboundMessage> } = {}) {
  const calls = {
    drafts: [] as unknown[],
    updates: [] as { expected: string[]; values: Record<string, unknown> }[],
    sent: [] as { otherCaseIds: string[]; communication: Record<string, unknown>; documents: { category: string }[] }[],
    stored: [] as string[],
    emails: [] as OutgoingEmail[],
  };
  const message: OutboundMessage = {
    id: MESSAGE_ID,
    caseId: CASE_ID,
    templateId: "t1",
    templateCode: "new_repair_order",
    templateName: "New repair order",
    language: "en",
    status: "draft",
    to: [],
    cc: [],
    subject: "",
    body: "",
    mergeData: {},
    createdAt: "2026-11-05T09:00:00Z",
    ...options.message,
  };
  const repository = {
    template: async (code: string, language: string) => (code === template.code && language === "en" ? template : null),
    caseContext: async (id: string) => (id === CASE_ID ? context : null),
    userSignature: async () => null,
    createDraft: async (draft: unknown) => {
      calls.drafts.push(draft);
      return MESSAGE_ID;
    },
    message: async (id: string) => (id === MESSAGE_ID ? message : null),
    caseDocuments: async () => [
      { id: DOCUMENT_ID, fileName: "estimate.pdf", mimeType: "application/pdf", size: 4, category: "estimate", storagePath: "cases/x/estimate.pdf" },
    ],
    readDocument: async () => new Uint8Array([1, 2, 3, 4]),
    storeDocument: async (path: string) => {
      calls.stored.push(path);
      return true;
    },
    removeDocuments: async () => {},
    casesByNumbers: async (numbers: string[]) =>
      numbers.includes("VCR20260006") ? [{ id: OTHER_CASE, caseNumber: "VCR20260006" }] : [],
    updateMessage: async (_id: string, expected: string[], values: Record<string, unknown>) => {
      calls.updates.push({ expected, values });
      return true;
    },
    recordSent: async (
      _id: string,
      otherCaseIds: string[],
      communication: Record<string, unknown>,
      documents: { category: string }[],
    ) => {
      calls.sent.push({ otherCaseIds, communication, documents });
      return { ok: true as const };
    },
  } as unknown as CommunicationRepository;
  const transport: EmailTransport = options.transport ?? {
    delivers: true,
    async send(email) {
      calls.emails.push(email);
      return { ok: true };
    },
  };
  const service = createCommunicationService({
    repository,
    transport,
    settings: { from: "Go Smart <cases@gosmart.example>", companyName: "Go Smart", invoicingEmail: null },
    now: () => new Date("2026-11-05T10:00:00Z"),
  });
  return { service, calls };
}

const form = {
  to: "Kevin Pauwels <kevin@riverside-bodyshop.example>",
  cc: "",
  bcc: "",
  subject: "New repair order DEM20260001",
  body: "Dear Riverside Body Shop BV",
  attachRepairOrder: "on",
  documentIds: [DOCUMENT_ID],
  linkCaseNumbers: "VCR20260006",
};

describe("template e-mails as drafts (UC-33)", () => {
  it("renders the template with the case's data and addresses its audience", async () => {
    const { service, calls } = setup();
    expect(await service.createDraft(CASE_ID, { templateCode: "new_repair_order", language: "en" }, USER)).toEqual({
      ok: true,
      id: MESSAGE_ID,
    });
    expect(calls.drafts[0]).toMatchObject({
      caseId: CASE_ID,
      templateId: "t1",
      to: ["Kevin Pauwels <kevin@riverside-bodyshop.example>"],
      subject: "New repair order DEM20260001",
      body: "Dear Riverside Body Shop BV, VIN . Alex Morgan",
    });
  });

  it("refuses an unknown template or language", async () => {
    const { service } = setup();
    expect(await service.createDraft(CASE_ID, { templateCode: "new_repair_order", language: "fr" }, USER)).toEqual({
      ok: false,
      formError: "Choose a template and a language.",
    });
    expect(await service.createDraft(CASE_ID, { templateCode: "nope", language: "nl" }, USER)).toEqual({
      ok: false,
      formError: "This template does not exist in that language.",
    });
  });

  it("shows which merge fields have no value on the case", async () => {
    const { service } = setup({ message: { mergeData: { "case.number": "DEM20260001", "repairer.name": "Riverside", "user.fullName": "Alex" } } });
    const view = await service.compose(CASE_ID, MESSAGE_ID);
    expect(view).toMatchObject({ missing: ["VIN"], attachRepairOrder: true, delivers: true });
    expect(view?.statusHint).toContain("UC-14");
  });
});

describe("sending (UC-13, UC-33)", () => {
  it("approves, sends with the repair-order PDF and logs it on every case named (BR-12)", async () => {
    const { service, calls } = setup();
    expect(await service.send(CASE_ID, MESSAGE_ID, form, USER)).toEqual({ ok: true });

    expect(calls.updates[0]).toMatchObject({ expected: ["draft", "failed"], values: { status: "approved", approvedBy: USER.id } });
    const [email] = calls.emails;
    expect(email.attachments.map((attachment) => attachment.fileName)).toEqual(["estimate.pdf", "repair-order-DEM20260001.pdf"]);
    expect(new TextDecoder().decode(email.attachments[1].content.slice(0, 5))).toBe("%PDF-");

    const [sent] = calls.sent;
    expect(sent.otherCaseIds).toEqual([OTHER_CASE]);
    expect(sent.communication).toMatchObject({ channel: "email", direction: "out", processed: true, sent_at: "2026-11-05T10:00:00.000Z" });
    expect(sent.documents.map((document) => document.category)).toEqual(["repair_order"]);
    expect(calls.stored).toHaveLength(1);
  });

  it("marks the message failed when the provider refuses it, and logs nothing", async () => {
    const { service, calls } = setup({
      transport: { delivers: true, send: async () => ({ ok: false, error: "The e-mail provider refused it." }) },
    });
    expect(await service.send(CASE_ID, MESSAGE_ID, form, USER)).toEqual({ ok: false, formError: "The e-mail provider refused it." });
    expect(calls.updates.at(-1)).toMatchObject({ expected: ["approved"], values: { status: "failed" } });
    expect(calls.sent).toEqual([]);
    expect(calls.stored).toEqual([]);
  });

  it("checks the other case numbers and the documents first", async () => {
    const { service, calls } = setup();
    expect(await service.send(CASE_ID, MESSAGE_ID, { ...form, linkCaseNumbers: "ABC20269999" }, USER)).toEqual({
      ok: false,
      fieldErrors: { linkCaseNumbers: ["There is no case ABC20269999."] },
    });
    expect(
      await service.send(CASE_ID, MESSAGE_ID, { ...form, documentIds: ["88888888-8888-4888-8888-888888888888"] }, USER),
    ).toEqual({ ok: false, fieldErrors: { documentIds: ["Choose documents of this case."] } });
    expect(calls.updates).toEqual([]);
  });

  it("only sends drafts of this case", async () => {
    const { service } = setup({ message: { status: "sent" } });
    expect(await service.send(CASE_ID, MESSAGE_ID, form, USER)).toEqual({
      ok: false,
      formError: "This draft no longer exists or has been sent.",
    });
    const other = setup();
    expect(await other.service.send(OTHER_CASE, MESSAGE_ID, form, USER)).toMatchObject({ ok: false });
  });
});
