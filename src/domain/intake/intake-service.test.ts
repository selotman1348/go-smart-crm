import { describe, expect, it } from "vitest";

import type { InboundMessage } from "./inbound-message";
import type { InboundAttachmentItem, InboundEmailDetail, InboundRepository, NewDocument, NewInboundEmail } from "./inbound-repository";
import { createIntakeService, documentCategoryFor, isDocumentAttachment } from "./intake-service";

const CASE_ID = "33333333-3333-4333-8333-333333333333";
const EMAIL_ID = "44444444-4444-4444-8444-444444444444";

function fakeRepository(overrides: Partial<InboundRepository> = {}) {
  const calls = {
    stored: [] as string[],
    documents: [] as string[],
    removed: [] as string[],
    received: [] as { email: NewInboundEmail; attachments: InboundAttachmentItem[]; caseIds: string[]; documents: NewDocument[] }[],
    linked: [] as { emailId: string; caseIds: string[]; converted: boolean; documents: NewDocument[] }[],
  };
  const repository = {
    findByMessageId: async () => null,
    store: async (path: string) => {
      calls.stored.push(path);
      return true;
    },
    storeDocument: async (path: string) => {
      calls.documents.push(path);
      return true;
    },
    read: async () => new Uint8Array([1, 2, 3]),
    remove: async (paths: string[]) => {
      calls.removed.push(...paths);
    },
    removeDocuments: async () => {},
    createUploadUrl: async () => "https://storage.example/upload",
    downloadUrl: async () => null,
    casesByNumbers: async (numbers: string[]) =>
      numbers.includes("DEM20260001") ? [{ id: CASE_ID, caseNumber: "DEM20260001" }] : [],
    receive: async (email: NewInboundEmail, attachments: InboundAttachmentItem[], caseIds: string[], documents: NewDocument[]) => {
      calls.received.push({ email, attachments, caseIds, documents });
      return { ok: true as const, id: email.id, duplicate: false };
    },
    link: async (emailId: string, caseIds: string[], converted: boolean, documents: NewDocument[]) => {
      calls.linked.push({ emailId, caseIds, converted, documents });
      return { ok: true as const };
    },
    list: async () => ({ rows: [], total: 0 }),
    get: async () => null,
    ensureDraft: async () => {},
    ...overrides,
  } as unknown as InboundRepository;
  return { repository, calls };
}

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const message = (subject: string, attachments: InboundMessage["attachments"] = []): InboundMessage => ({
  messageId: "m-1@example.com",
  from: "claims@brightline-brokers.example",
  to: ["intake@gosmart.example"],
  cc: [],
  subject,
  text: null,
  html: "<p>Hello</p>",
  receivedAt: "2026-11-05T09:00:00.000Z",
  attachments,
});

const pdf = { fileName: "claim.pdf", mimeType: "application/pdf", content: new Uint8Array([37, 80, 68, 70]) };
const zip = { fileName: "photos.zip", mimeType: "application/zip", content: new Uint8Array([80, 75]) };

describe("receiving an e-mail (plan.md 2.1)", () => {
  it("links an e-mail with a case number to that case, attachments as documents (BR-10)", async () => {
    const { repository, calls } = fakeRepository();
    const intake = createIntakeService(repository, newId);
    const result = await intake.receive(message("RE: DEM20260001 estimate", [pdf, zip]), {
      content: new Uint8Array([1]),
      extension: "json",
    });
    expect(result).toMatchObject({ ok: true, duplicate: false, linkedCaseNumbers: ["DEM20260001"] });
    const [received] = calls.received;
    expect(received.caseIds).toEqual([CASE_ID]);
    expect(received.email.bodyText).toBe("Hello");
    expect(received.attachments.map((attachment) => attachment.fileName)).toEqual(["claim.pdf", "photos.zip"]);
    // Only document types become case documents.
    expect(received.documents.map((document) => [document.fileName, document.category])).toEqual([["claim.pdf", "other"]]);
    expect(calls.documents[0]).toMatch(new RegExp(`^cases/${CASE_ID}/.+/claim\\.pdf$`));
    expect(calls.stored[0]).toMatch(/\/raw\.json$/);
  });

  it("leaves an e-mail without a known case number for the Inbox", async () => {
    const { repository, calls } = fakeRepository();
    const intake = createIntakeService(repository, newId);
    const result = await intake.receive(message("New assignment XYZ20269999", [pdf]), { content: new Uint8Array([1]), extension: "eml" });
    expect(result).toMatchObject({ ok: true, linkedCaseNumbers: [] });
    expect(calls.received[0].caseIds).toEqual([]);
    expect(calls.received[0].documents).toEqual([]);
    expect(calls.documents).toEqual([]);
  });

  it("does not store an e-mail twice", async () => {
    const { repository, calls } = fakeRepository({ findByMessageId: async () => EMAIL_ID });
    const intake = createIntakeService(repository, newId);
    const result = await intake.receive(message("DEM20260001"), { content: new Uint8Array([1]), extension: "json" });
    expect(result).toEqual({ ok: true, id: EMAIL_ID, duplicate: true, linkedCaseNumbers: [] });
    expect(calls.stored).toEqual([]);
    expect(calls.received).toEqual([]);
  });

  it("removes what it stored when the database refuses the e-mail", async () => {
    const { repository, calls } = fakeRepository({
      receive: async () => ({ ok: false as const, error: { message: "boom" } }),
    });
    const intake = createIntakeService(repository, newId);
    const result = await intake.receive(message("hello", [pdf]), { content: new Uint8Array([1]), extension: "json" });
    expect(result.ok).toBe(false);
    expect(calls.removed).toEqual(calls.stored);
  });
});

describe("Inbox actions", () => {
  const waiting: InboundEmailDetail = {
    id: EMAIL_ID,
    receivedAt: "2026-11-05T09:00:00.000Z",
    from: "claims@brightline-brokers.example",
    subject: "New assignment",
    status: "triage",
    linkedCaseId: null,
    linkedCaseNumber: null,
    attachmentCount: 1,
    to: [],
    cc: [],
    bodyText: "Hello",
    attachments: [{ id: "a1", fileName: "photo.jpg", mimeType: "image/jpeg", size: 3, storagePath: `${EMAIL_ID}/a1/photo.jpg` }],
  };

  it("links a waiting e-mail by case number, with its attachments", async () => {
    const { repository, calls } = fakeRepository({ get: async () => waiting });
    const intake = createIntakeService(repository, newId);
    expect(await intake.link(EMAIL_ID, " dem20260001")).toEqual({ ok: true, caseId: CASE_ID });
    expect(calls.linked[0]).toMatchObject({ emailId: EMAIL_ID, caseIds: [CASE_ID], converted: false });
    expect(calls.linked[0].documents.map((document) => document.category)).toEqual(["photo"]);
  });

  it("explains a wrong case number or an e-mail handled before", async () => {
    const { repository } = fakeRepository({ get: async () => waiting });
    const intake = createIntakeService(repository, newId);
    expect(await intake.link(EMAIL_ID, "nonsense")).toEqual({ ok: false, error: "Enter a case number, for example DEM20260001." });
    expect(await intake.link(EMAIL_ID, "ABC20269999")).toEqual({ ok: false, error: "There is no case ABC20269999." });

    const handled = fakeRepository({ get: async () => ({ ...waiting, status: "linked" as const }) });
    const again = createIntakeService(handled.repository, newId);
    expect(await again.link(EMAIL_ID, "DEM20260001")).toEqual({ ok: false, error: "This e-mail has been handled in the meantime." });
    expect(await again.prepareConversion(EMAIL_ID)).toEqual({ ok: false, error: "This e-mail has been handled in the meantime." });
  });

  it("converts the e-mail into the new case", async () => {
    const { repository, calls } = fakeRepository({ get: async () => waiting });
    const intake = createIntakeService(repository, newId);
    expect(await intake.prepareConversion(EMAIL_ID)).toEqual({ ok: true });
    expect(await intake.convert(EMAIL_ID, CASE_ID)).toEqual({ ok: true });
    expect(calls.linked[0]).toMatchObject({ caseIds: [CASE_ID], converted: true });
  });

  it("accepts only .eml files up to 25 MB for upload", async () => {
    const { repository } = fakeRepository();
    const intake = createIntakeService(repository, newId);
    expect(await intake.prepareEmlUpload({ fileName: "mail.msg", size: 10 })).toEqual({ ok: false, error: "Choose an .eml file." });
    expect(await intake.prepareEmlUpload({ fileName: "mail.eml", size: 26 * 1024 * 1024 })).toEqual({
      ok: false,
      error: "The file must be smaller than 25 MB.",
    });
    expect(await intake.prepareEmlUpload({ fileName: "Mail.EML", size: 10 })).toMatchObject({ ok: true });
  });
});

describe("attachment rules", () => {
  it("files images as photos and accepts only document types up to 20 MB", () => {
    expect(documentCategoryFor("image/png")).toBe("photo");
    expect(documentCategoryFor("application/pdf")).toBe("other");
    expect(isDocumentAttachment({ mimeType: "application/pdf", size: 100 })).toBe(true);
    expect(isDocumentAttachment({ mimeType: "application/zip", size: 100 })).toBe(false);
    expect(isDocumentAttachment({ mimeType: "application/pdf", size: 21 * 1024 * 1024 })).toBe(false);
  });
});
