import { describe, expect, it } from "vitest";

import { caseNumbersInSubject, normalizeCaseNumber } from "./case-number-match";
import { bodyText, formatMailbox, fromEml, fromPostmark, htmlToText, mailboxAddress } from "./inbound-message";
import { isAuthorizedWebhook } from "./webhook-auth";

describe("caseNumbersInSubject (BR-10)", () => {
  it("finds case numbers of 2–4 capital letters, a year and a sequence", () => {
    expect(caseNumbersInSubject("RE: Estimate DEM20260001 – 1-ABC-123")).toEqual(["DEM20260001"]);
    expect(caseNumbersInSubject("[VCR20260006] photos")).toEqual(["VCR20260006"]);
    expect(caseNumbersInSubject("AB20260012 and ABCD20251234")).toEqual(["AB20260012", "ABCD20251234"]);
  });

  it("ignores lookalikes and repeats", () => {
    expect(caseNumbersInSubject("dem20260001")).toEqual([]);
    expect(caseNumbersInSubject("XDEMO20260001")).toEqual([]);
    expect(caseNumbersInSubject("DEM202600011")).toEqual([]);
    expect(caseNumbersInSubject("DEM2026000")).toEqual([]);
    expect(caseNumbersInSubject("Policy 20260001")).toEqual([]);
    expect(caseNumbersInSubject("DEM20260001 / DEM20260001")).toEqual(["DEM20260001"]);
    expect(caseNumbersInSubject(null)).toEqual([]);
  });

  it("normalises a typed case number", () => {
    expect(normalizeCaseNumber(" dem20260001 ")).toBe("DEM20260001");
    expect(normalizeCaseNumber("DEM2026001")).toBeNull();
    expect(normalizeCaseNumber(42)).toBeNull();
  });
});

describe("mailboxes", () => {
  it("formats and reads Name <address>", () => {
    expect(formatMailbox("kim@example.com", "Kim \"Ops\" Peeters")).toBe("Kim Ops Peeters <kim@example.com>");
    expect(formatMailbox("kim@example.com", " ")).toBe("kim@example.com");
    expect(mailboxAddress("Kim Peeters <kim@example.com>")).toBe("kim@example.com");
    expect(mailboxAddress(" kim@example.com ")).toBe("kim@example.com");
  });
});

describe("fromPostmark", () => {
  const payload = {
    FromFull: { Email: "claims@brightline-brokers.example", Name: "Brightline Brokers" },
    ToFull: [{ Email: "intake@gosmart.example", Name: "" }],
    CcFull: [{ Email: "ops@brightline-brokers.example", Name: "Ops" }],
    Subject: "New assignment 1-ABC-123",
    MessageID: "provider-id",
    Date: "Thu, 5 Nov 2026 10:15:00 +0100",
    TextBody: "Please repair the rear bumper.",
    HtmlBody: "<p>Please repair</p>",
    Headers: [{ Name: "Message-ID", Value: "<abc@mail.example>" }],
    Attachments: [{ Name: "claim.pdf", Content: Buffer.from("%PDF-1.4").toString("base64"), ContentType: "application/pdf" }],
  };

  it("reads the provider's inbound JSON", () => {
    const message = fromPostmark(payload);
    expect(message).toMatchObject({
      messageId: "abc@mail.example",
      from: "Brightline Brokers <claims@brightline-brokers.example>",
      to: ["intake@gosmart.example"],
      cc: ["Ops <ops@brightline-brokers.example>"],
      subject: "New assignment 1-ABC-123",
      text: "Please repair the rear bumper.",
      receivedAt: "2026-11-05T09:15:00.000Z",
    });
    expect(message?.attachments).toHaveLength(1);
    expect(new TextDecoder().decode(message!.attachments[0].content)).toBe("%PDF-1.4");
  });

  it("falls back to the provider's id and rejects other payloads", () => {
    expect(fromPostmark({ ...payload, Headers: [] })?.messageId).toBe("provider-id");
    expect(fromPostmark({ hello: "world" })).toBeNull();
    expect(fromPostmark("text")).toBeNull();
  });
});

describe("fromEml", () => {
  const eml = [
    "From: Riverside Body Shop <estimates@riverside-bodyshop.example>",
    "To: intake@gosmart.example",
    "Subject: Estimate DEM20260001",
    "Message-ID: <est-1@riverside-bodyshop.example>",
    "Date: Thu, 05 Nov 2026 11:00:00 +0100",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="b1"',
    "",
    "--b1",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Estimate attached.",
    "--b1",
    'Content-Type: application/pdf; name="estimate.pdf"',
    'Content-Disposition: attachment; filename="estimate.pdf"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("%PDF-1.4 estimate").toString("base64"),
    "--b1--",
    "",
  ].join("\r\n");

  it("reads a raw e-mail with its attachments", async () => {
    const message = await fromEml(eml);
    expect(message).toMatchObject({
      messageId: "est-1@riverside-bodyshop.example",
      from: "Riverside Body Shop <estimates@riverside-bodyshop.example>",
      to: ["intake@gosmart.example"],
      subject: "Estimate DEM20260001",
      receivedAt: "2026-11-05T10:00:00.000Z",
    });
    expect(message.text?.trim()).toBe("Estimate attached.");
    expect(message.attachments.map((attachment) => [attachment.fileName, attachment.mimeType])).toEqual([
      ["estimate.pdf", "application/pdf"],
    ]);
    expect(new TextDecoder().decode(message.attachments[0].content)).toBe("%PDF-1.4 estimate");
  });

  it("rejects text that is not an e-mail", async () => {
    await expect(fromEml("just some words")).rejects.toThrow();
  });
});

describe("body text", () => {
  it("turns HTML into readable text and prefers the text part", () => {
    expect(htmlToText("<style>p{}</style><p>Hello&nbsp;<b>Kim</b></p><p>A &amp; B<br>C</p>")).toBe("Hello Kim\nA & B\nC");
    expect(bodyText({ text: "Plain", html: "<p>Html</p>" })).toBe("Plain");
    expect(bodyText({ text: " ", html: "<p>Html</p>" })).toBe("Html");
    expect(bodyText({ text: null, html: null })).toBeNull();
  });
});

describe("isAuthorizedWebhook", () => {
  const basic = (credentials: string) => `Basic ${Buffer.from(credentials).toString("base64")}`;

  it("accepts the shared secret as the Basic password", () => {
    expect(isAuthorizedWebhook(basic("postmark:s3cret-value"), "s3cret-value")).toBe(true);
  });

  it("refuses wrong, missing or unconfigured secrets", () => {
    expect(isAuthorizedWebhook(basic("postmark:wrong"), "s3cret-value")).toBe(false);
    expect(isAuthorizedWebhook(null, "s3cret-value")).toBe(false);
    expect(isAuthorizedWebhook("Bearer s3cret-value", "s3cret-value")).toBe(false);
    expect(isAuthorizedWebhook(basic("postmark:"), undefined)).toBe(false);
    expect(isAuthorizedWebhook(basic("postmark:"), "")).toBe(false);
  });
});
