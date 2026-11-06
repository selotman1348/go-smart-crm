import { expect, test, type APIRequestContext } from "@playwright/test";

import {
  adminClient,
  openCaseTab,
  removeInboundEmails,
  removeTestClient,
  requireCredentials,
  signIn,
  testClientCode,
  testName,
} from "./helpers";

// Iteration 4 main flow: a forwarded e-mail appears on the right case, or in
// the Inbox (plan.md section 4), plus sending a template e-mail with the
// repair-order PDF and logging a phone call. Test data is removed afterwards.
test.describe.configure({ mode: "serial" });

const clientCode = testClientCode();
const caseNumber = `${clientCode}20260001`;
const token = `E2E-${Date.now().toString(36)}`;
let clientId = "";
let caseId = "";
const clientName = testName("Mail client");

const authorization = () =>
  `Basic ${Buffer.from(`postmark:${process.env.INBOUND_EMAIL_SECRET ?? ""}`).toString("base64")}`;

/** What the e-mail provider posts for each e-mail to the intake address. */
function inboundPayload(subject: string, attachments: { name: string; type: string; content: string }[] = []) {
  return {
    FromFull: { Email: "claims@harbourline.example", Name: "Harbourline Claims" },
    ToFull: [{ Email: "intake@gosmart.example", Name: "" }],
    CcFull: [],
    Subject: subject,
    MessageID: crypto.randomUUID(),
    Date: new Date().toUTCString(),
    TextBody: `Please handle this damage. ${token}`,
    HtmlBody: "",
    Headers: [{ Name: "Message-ID", Value: `<${crypto.randomUUID()}@harbourline.example>` }],
    Attachments: attachments.map((attachment) => ({
      Name: attachment.name,
      ContentType: attachment.type,
      Content: Buffer.from(attachment.content).toString("base64"),
    })),
  };
}

async function postInbound(request: APIRequestContext, payload: object) {
  const response = await request.post("/api/inbound-email", { headers: { authorization: authorization() }, data: payload });
  expect(response.status()).toBe(200);
  return (await response.json()) as { id: string; linkedCaseNumbers: string[] };
}

test.beforeAll(async () => {
  requireCredentials();
  if (!process.env.INBOUND_EMAIL_SECRET) {
    throw new Error("Set INBOUND_EMAIL_SECRET (see .env.example) for the inbound webhook tests.");
  }
  const db = adminClient();
  const { data: client, error } = await db
    .from("account")
    .insert({ name: clientName, account_type: ["client"], client_code: clientCode })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Could not create the test client: ${error.message}`);
  }
  clientId = client.id;
  const { data: created, error: caseError } = await db
    .from("case")
    .insert({ case_number: caseNumber, client_account_id: clientId, status: "client_assignment" })
    .select("id")
    .single();
  if (caseError) {
    throw new Error(`Could not create the test case: ${caseError.message}`);
  }
  caseId = created.id;
  const { data: repairer } = await db.from("account").select("id").eq("name", "Riverside Body Shop BV").single();
  await db.from("case_party").insert([
    { case_id: caseId, role: "owner_fleet_owner", account_id: clientId },
    { case_id: caseId, role: "repairer", account_id: repairer!.id },
  ]);
});

test.afterAll(async () => {
  await removeTestClient(clientId);
  await removeInboundEmails([], token);
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the webhook refuses calls without the shared secret", async ({ request }) => {
  const response = await request.post("/api/inbound-email", { data: inboundPayload(`${caseNumber} ${token}`) });
  expect(response.status()).toBe(401);
});

test("a forwarded e-mail with the case number appears on that case (BR-10)", async ({ page, request }) => {
  const subject = `RE: ${caseNumber} photos ${token}`;
  const result = await postInbound(
    request,
    inboundPayload(subject, [
      { name: "e2e-damage-photo.pdf", type: "application/pdf", content: "%PDF-1.4\n% e2e\n" },
      { name: "e2e-archive.zip", type: "application/zip", content: "PK" },
    ]),
  );
  expect(result.linkedCaseNumbers).toEqual([caseNumber]);

  await page.goto(`/cases/${caseId}/communications?filter=email_in`);
  const log = page.getByRole("list", { name: "Communications" });
  const entry = log.getByRole("listitem").filter({ hasText: subject });
  await expect(entry).toContainText("E-mail in");
  await expect(entry).toContainText("Harbourline Claims <claims@harbourline.example>");
  await entry.getByText("Show message").click();
  await expect(entry.getByRole("link", { name: "e2e-damage-photo.pdf" })).toBeVisible();

  // UC-35: mark as processed.
  await entry.getByRole("button", { name: /^Mark as processed/ }).click();
  await expect(entry.getByText("Processed", { exact: true })).toBeVisible();

  // The document-type attachment is a case document; the archive stays with the e-mail.
  await openCaseTab(page, "Documents");
  await expect(page.getByRole("link", { name: "e2e-damage-photo.pdf" })).toBeVisible();
  await expect(page.getByText("e2e-archive.zip")).toHaveCount(0);
});

test("an e-mail without a case number waits in the Inbox and becomes a case", async ({ page, request }) => {
  const subject = `New assignment 1-ZZZ-999 ${token}`;
  const result = await postInbound(request, inboundPayload(subject));
  expect(result.linkedCaseNumbers).toEqual([]);

  await page.goto("/inbox");
  await page.getByRole("link", { name: subject }).click();
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();
  await page.getByRole("button", { name: "Create case from e-mail" }).click();

  // The new-case form with the e-mail beside it (plan.md 2.1).
  await expect(page.getByRole("heading", { name: "New case from e-mail" })).toBeVisible();
  await expect(page.getByRole("article", { name: "E-mail" })).toContainText(token);
  await page.getByRole("combobox", { name: "Client" }).selectOption({ label: clientName });
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `${clientCode}20260002` })).toBeVisible();

  await openCaseTab(page, "Communications");
  await expect(page.getByRole("list", { name: "Communications" })).toContainText(subject);

  await page.goto(`/inbox/${result.id}`);
  await expect(page.getByText("Case created", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create case from e-mail" })).toHaveCount(0);
});

test("an uploaded .eml is linked to a case from the Inbox", async ({ page }) => {
  const subject = `Estimate for the bumper ${token}`;
  const eml = [
    "From: Riverside Body Shop <info@riverside-bodyshop.example>",
    "To: intake@gosmart.example",
    `Subject: ${subject}`,
    `Message-ID: <${crypto.randomUUID()}@riverside-bodyshop.example>`,
    `Date: ${new Date().toUTCString()}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Our estimate follows.",
    "",
  ].join("\r\n");

  await page.goto("/inbox");
  await page.getByLabel("E-mail file (.eml)").setInputFiles({ name: "estimate.eml", mimeType: "message/rfc822", buffer: Buffer.from(eml) });
  await page.getByRole("button", { name: "Upload .eml" }).click();
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();

  const link = page.getByRole("form", { name: "Link to case" });
  await link.getByRole("textbox", { name: "Case number" }).fill("ZZZ20269999");
  await link.getByRole("button", { name: "Link to case" }).click();
  await expect(link.getByText("There is no case ZZZ20269999.")).toBeVisible();
  await link.getByRole("textbox", { name: "Case number" }).fill(caseNumber.toLowerCase());
  await link.getByRole("button", { name: "Link to case" }).click();
  await expect(page.getByText("Linked", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: caseNumber })).toBeVisible();

  await page.goto(`/cases/${caseId}/communications`);
  await expect(page.getByRole("list", { name: "Communications" })).toContainText(subject);
});

test("the repair order goes to the repairer with the generated PDF (UC-13)", async ({ page }) => {
  await page.goto(`/cases/${caseId}/communications`);
  const form = page.getByRole("form", { name: "New e-mail" });
  await form.getByRole("combobox", { name: "Template" }).selectOption({ label: "New repair order" });
  await form.getByRole("button", { name: "Write e-mail" }).click();

  const compose = page.getByRole("form", { name: "Compose e-mail" });
  await expect(compose.getByRole("textbox", { name: "To" })).toHaveValue("Riverside Body Shop BV <info@riverside-bodyshop.example>");
  await expect(compose.getByRole("textbox", { name: "Subject" })).toHaveValue(new RegExp(`^New repair order ${caseNumber}`));
  await expect(compose.getByRole("checkbox", { name: "Repair order (generated PDF)" })).toBeChecked();
  await expect(page.getByRole("note").filter({ hasText: "The case has no value for" })).toContainText("Licence plate");

  const pdf = await page.request.get(`/cases/${caseId}/repair-order`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await compose.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status").filter({ hasText: "E-mail sent and logged below." })).toBeVisible();
  await page.getByRole("navigation", { name: "Communication filters" }).getByRole("link", { name: "E-mails out" }).click();
  const entry = page.getByRole("list", { name: "Communications" }).getByRole("listitem").filter({ hasText: `New repair order ${caseNumber}` });
  await expect(entry).toContainText("to Riverside Body Shop BV <info@riverside-bodyshop.example>");
  await entry.getByText("Show message").click();
  await expect(entry.getByRole("link", { name: `repair-order-${caseNumber}.pdf` })).toBeVisible();

  await openCaseTab(page, "Documents");
  await expect(page.getByRole("link", { name: `repair-order-${caseNumber}.pdf` })).toBeVisible();
});

test("a phone call is logged and found with the filter (UC-35)", async ({ page }) => {
  await page.goto(`/cases/${caseId}/communications`);
  const form = page.getByRole("form", { name: "Add communication" });
  await form.getByRole("button", { name: "Add communication" }).click();
  await expect(form.getByText("Enter a subject.")).toBeVisible();
  await form.getByRole("textbox", { name: "Subject" }).fill("Driver called about the appointment");
  await form.getByRole("textbox", { name: "Notes" }).fill("Prefers Tuesday morning.");
  await form.getByRole("button", { name: "Add communication" }).click();
  await expect(form.getByRole("status")).toHaveText("Changes saved.");

  const filters = page.getByRole("navigation", { name: "Communication filters" });
  await filters.getByRole("link", { name: "Phone calls" }).click();
  const log = page.getByRole("list", { name: "Communications" });
  await expect(log.getByRole("listitem")).toHaveCount(1);
  await expect(log).toContainText("Driver called about the appointment");
  await filters.getByRole("link", { name: "E-mails out" }).click();
  await expect(log).not.toContainText("Driver called about the appointment");
});
