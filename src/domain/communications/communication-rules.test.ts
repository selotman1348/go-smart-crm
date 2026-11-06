import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  filterCriteria,
  parseAddressList,
  parseCaseNumbers,
  parseCommunicationFilter,
  parseComposeInput,
  parseLogInput,
} from "./communication-input";
import { createPostmarkTransport, textToHtml } from "./email-transport";
import { buildMergeData, renderTemplate } from "./merge-fields";
import { renderRepairOrderPdf, repairOrderFileName } from "./repair-order-pdf";
import { recipientsFor } from "./templates";
import { context } from "./test-context";

describe("merge fields (UC-33)", () => {
  const data = buildMergeData(context, { fullName: "Alex Morgan", signature: null });

  it("fills the case's data in", () => {
    expect(data["case.number"]).toBe("DEM20260001");
    expect(data["driver.name"]).toBe("Lena Claes");
    expect(data["repairer.name"]).toBe("Riverside Body Shop BV");
    expect(data["repairer.discountPct"]).toBe("13");
    expect(data["damage.date"]).toBe("03/11/2026");
    expect(data["case.appointmentRepair"]).toBe("10/11/2026 08:00");
    expect(renderTemplate("Case {{case.number}} – {{ vehicle.licencePlate }}", data)).toEqual({
      text: "Case DEM20260001 – 1-ABC-123",
      missing: [],
    });
  });

  it("reports fields without a value and keeps unknown placeholders", () => {
    expect(renderTemplate("VIN {{vehicle.vin}}, {{expert.name}}, {{foo.bar}}", data)).toEqual({
      text: "VIN , , {{foo.bar}}",
      missing: ["vehicle.vin", "expert.name"],
    });
  });
});

describe("recipientsFor", () => {
  it("addresses every party with the template's audience role", () => {
    expect(recipientsFor("repairer", context.parties)).toEqual(["Kevin Pauwels <kevin@riverside-bodyshop.example>"]);
    expect(recipientsFor("intermediary", context.parties)).toEqual(["Brightline Brokers <claims@brightline-brokers.example>"]);
    expect(recipientsFor("expert", context.parties)).toEqual([]);
    expect(recipientsFor(null, context.parties)).toEqual([]);
  });
});

describe("addresses and case numbers", () => {
  it("accepts plain and named addresses, separated by commas, semicolons or lines", () => {
    expect(parseAddressList("a@example.com; Kim <kim@example.com>\nb@example.com, a@example.com")).toEqual({
      ok: true,
      value: ["a@example.com", "Kim <kim@example.com>", "b@example.com"],
    });
    expect(parseAddressList("")).toEqual({ ok: true, value: [] });
    expect(parseAddressList("kim@, b@example.com")).toEqual({ ok: false, error: "“kim@” is not a valid e-mail address." });
  });

  it("reads case numbers to log an e-mail on several cases (BR-12)", () => {
    expect(parseCaseNumbers("dem20260002, VCR20260006 DEM20260002")).toEqual({ ok: true, value: ["DEM20260002", "VCR20260006"] });
    expect(parseCaseNumbers("DEM2026")).toEqual({ ok: false, error: "“DEM2026” is not a case number." });
  });
});

describe("compose input", () => {
  const form = { to: "kim@example.com", cc: "", bcc: "", subject: "Repair order", body: "Hello", documentIds: [], linkCaseNumbers: "" };

  it("needs a recipient, a subject and a message to send", () => {
    expect(parseComposeInput({ ...form, attachRepairOrder: "on" }, { sending: true })).toEqual({
      ok: true,
      value: {
        to: ["kim@example.com"],
        cc: [],
        bcc: [],
        subject: "Repair order",
        body: "Hello",
        attachRepairOrder: true,
        documentIds: [],
        linkCaseNumbers: [],
      },
    });
    const missing = parseComposeInput({ ...form, to: "", subject: " ", body: "" }, { sending: true });
    expect(missing).toEqual({
      ok: false,
      fieldErrors: { to: ["Enter at least one recipient."], subject: ["Enter a subject."], body: ["Enter the message."] },
    });
  });

  it("allows a draft without recipients", () => {
    expect(parseComposeInput({ ...form, to: "" }, { sending: false }).ok).toBe(true);
  });
});

describe("log input (UC-35)", () => {
  it("records a phone call with a subject", () => {
    expect(
      parseLogInput({ channel: "phone", direction: "in", subject: "Driver called", body: "", occurredAt: "2026-11-05T14:30" }),
    ).toEqual({
      ok: true,
      value: { channel: "phone", direction: "in", subject: "Driver called", body: null, occurredAt: "2026-11-05T13:30:00.000Z" },
    });
    const invalid = parseLogInput({ channel: "email", direction: "in", subject: "" });
    expect(invalid.ok).toBe(false);
    expect(invalid.ok ? null : Object.keys(invalid.fieldErrors).sort()).toEqual(["channel", "subject"]);
  });

  it("maps the log filters", () => {
    expect(parseCommunicationFilter("email_out")).toBe("email_out");
    expect(parseCommunicationFilter("nonsense")).toBe("all");
    expect(filterCriteria("email_in")).toEqual({ channel: "email", direction: "in" });
    expect(filterCriteria("phone")).toEqual({ channel: "phone", direction: null });
    expect(filterCriteria("all")).toEqual({ channel: null, direction: null });
  });
});

describe("repair-order PDF (UC-13)", () => {
  it("renders a PDF, also for names the standard font cannot draw", async () => {
    const pdf = await renderRepairOrderPdf(
      { ...context, client: { name: "Łódź Fleet Sp. z o.o. – Ünal", address: null } },
      { issuedAt: new Date("2026-11-05T10:00:00Z"), companyName: "Go Smart", invoicingEmail: "invoices@gosmart.example" },
    );
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getTitle()).toBe("Repair order DEM20260001");
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(repairOrderFileName("DEM20260001")).toBe("repair-order-DEM20260001.pdf");
  });
});

describe("outbound e-mail", () => {
  it("escapes the plain-text body into HTML paragraphs", () => {
    expect(textToHtml("Dear <Kim>,\n\nLine 1\nLine 2")).toContain("<p>Dear &lt;Kim&gt;,</p><p>Line 1<br>Line 2</p>");
  });

  it("posts the message to the provider", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const fetchStub = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ ErrorCode: 0 }), { status: 200 });
    }) as unknown as typeof fetch;
    const transport = createPostmarkTransport("server-token", fetchStub);
    const result = await transport.send({
      from: "Go Smart <cases@gosmart.example>",
      to: ["kim@example.com", "lena@example.com"],
      cc: [],
      bcc: ["archive@gosmart.example"],
      subject: "Repair order",
      text: "Hello",
      attachments: [{ fileName: "a.pdf", mimeType: "application/pdf", content: new Uint8Array([1, 2]) }],
    });
    expect(result).toEqual({ ok: true });
    expect(requests[0].url).toBe("https://api.postmarkapp.com/email");
    expect((requests[0].init.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe("server-token");
    const body = JSON.parse(requests[0].init.body as string);
    expect(body).toMatchObject({ To: "kim@example.com, lena@example.com", Bcc: "archive@gosmart.example", Subject: "Repair order" });
    expect(body.Cc).toBeUndefined();
    expect(body.Attachments).toEqual([{ Name: "a.pdf", Content: "AQI=", ContentType: "application/pdf" }]);
  });

  it("reports the provider's refusal", async () => {
    const fetchStub = (async () =>
      new Response(JSON.stringify({ ErrorCode: 300, Message: "Invalid 'To' address" }), { status: 422 })) as unknown as typeof fetch;
    const result = await createPostmarkTransport("t", fetchStub).send({
      from: "a@example.com",
      to: ["x"],
      cc: [],
      bcc: [],
      subject: "s",
      text: "t",
      attachments: [],
    });
    expect(result).toEqual({ ok: false, error: "The e-mail provider refused it: Invalid 'To' address" });
  });
});
