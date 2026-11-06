import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { adminClient, openCaseTab, removeCases, removeInboundEmails, requireCredentials, signIn } from "./helpers";

// The demo script of docs/plan.md section 5, end to end, with the sample
// e-mails in docs/demo/. It works on the seeded client Demo Fleet BV, so the
// first run on a fresh database creates DEM20260001; the case is removed
// afterwards, which keeps that number free for the live demo.
test.describe.configure({ mode: "serial" });

const token = `E2E-${Date.now().toString(36)}`;
const plate = `2-DM${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${String(Math.floor(Math.random() * 900) + 100)}`;
let caseId = "";
const inboundIds: string[] = [];

const authorization = () =>
  `Basic ${Buffer.from(`postmark:${process.env.INBOUND_EMAIL_SECRET ?? ""}`).toString("base64")}`;

/** A sample e-mail from docs/demo, as the provider forwards it (raw message). */
function sampleEmail(file: string, replace: Record<string, string>): string {
  let eml = readFileSync(`docs/demo/${file}`, "utf8");
  for (const [from, to] of Object.entries(replace)) {
    eml = eml.split(from).join(to);
  }
  return eml;
}

const statusBadge = (page: Page, label: string) =>
  page.locator('header [data-slot="badge"]').filter({ hasText: new RegExp(`^${label.replace(/[()]/g, "\\$&")}$`) });

async function changeStatus(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption({ label });
  await page.getByRole("button", { name: "Change status" }).click();
  await expect(statusBadge(page, label)).toBeVisible();
}

async function sendTemplate(page: Page, template: string) {
  await openCaseTab(page, "Communications");
  const form = page.getByRole("form", { name: "New e-mail" });
  await form.getByRole("combobox", { name: "Template" }).selectOption({ label: template });
  await form.getByRole("button", { name: "Write e-mail" }).click();
  const compose = page.getByRole("form", { name: "Compose e-mail" });
  await expect(compose.getByRole("textbox", { name: "To" })).not.toHaveValue("");
  await compose.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status").filter({ hasText: "E-mail sent and logged below." })).toBeVisible();
}

test.beforeAll(() => {
  requireCredentials();
  if (!process.env.INBOUND_EMAIL_SECRET) {
    throw new Error("Set INBOUND_EMAIL_SECRET (see .env.example) for the demo test.");
  }
});

test.afterAll(async () => {
  if (caseId) {
    await removeCases([caseId]);
  }
  await removeInboundEmails(inboundIds, token);
});

test("the demo script runs end to end (plan.md section 5)", async ({ page, request }) => {
  test.setTimeout(240_000);
  const db = adminClient();
  const { data: existing } = await db.from("case").select("case_number").like("case_number", "DEM2026%");
  const expectedNumber = `DEM2026${String((existing?.length ?? 0) + 1).padStart(4, "0")}`;
  await signIn(page);

  // 1. A broker assignment e-mail arrives at the intake address: it appears in the Inbox.
  const subject = `New repair assignment - Demo Fleet BV - ${plate} ${token}`;
  const received = await request.post("/api/inbound-email", {
    headers: { authorization: authorization(), "content-type": "message/rfc822" },
    data: sampleEmail("broker-assignment.eml", { "New repair assignment - Demo Fleet BV - 2-DMO-001": subject, "2-DMO-001": plate }),
  });
  expect(received.status()).toBe(200);
  const assignment = (await received.json()) as { id: string; linkedCaseNumbers: string[] };
  inboundIds.push(assignment.id);
  expect(assignment.linkedCaseNumbers).toEqual([]);
  await page.goto("/inbox");
  await page.getByRole("link", { name: subject }).click();

  // 2. "Create case from e-mail": the next DEM number (DEM20260001 on a fresh database).
  await page.getByRole("button", { name: "Create case from e-mail" }).click();
  await expect(page.getByRole("article", { name: "E-mail" })).toContainText("HLB-26-0420");
  await page.getByRole("combobox", { name: "Client" }).selectOption({ label: "Demo Fleet BV" });
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByRole("heading", { level: 1, name: expectedNumber })).toBeVisible();
  caseId = page.url().split("/cases/")[1].split(/[/?]/)[0];
  const caseNumber = expectedNumber;

  await page.getByRole("textbox", { name: "Broker ref." }).fill("HLB-26-0420");
  await page.getByRole("textbox", { name: "Insurer ref." }).fill("ATL-26-009871");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");

  await openCaseTab(page, "Vehicle");
  await page.getByRole("textbox", { name: "Licence plate", exact: true }).fill(plate);
  await page.getByRole("textbox", { name: "Make" }).fill("Volkswagen");
  await page.getByRole("textbox", { name: "Model", exact: true }).fill("ID.4");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");

  await openCaseTab(page, "Parties");
  const addParty = async (role: string, account: string | null, person: string | null) => {
    await page.getByRole("combobox", { name: "Role" }).selectOption(role);
    if (account) {
      await page.getByRole("combobox", { name: "Account", exact: true }).selectOption({ label: account });
    }
    if (person) {
      await page.getByRole("combobox", { name: role === "driver" ? "Person" : "Contact person (optional)" }).selectOption({ label: person });
    }
    await page.getByRole("button", { name: "Add party" }).click();
  };
  await addParty("repairer", "Riverside Body Shop BV", "Kevin Pauwels");
  await expect(page.getByRole("row", { name: /Repairer Riverside Body Shop BV Kevin Pauwels/ })).toBeVisible();
  await addParty("driver", null, "Sara Michiels (Demo Fleet BV)");
  await expect(page.getByRole("row", { name: /Driver .*Sara Michiels/ })).toBeVisible();
  await addParty("intermediary", "Harbourline Insurance Brokers BV", "Louise Mertens");
  await expect(page.getByRole("row", { name: /Intermediary Harbourline Insurance Brokers BV Louise Mertens/ })).toBeVisible();

  await openCaseTab(page, "Damage");
  await page.getByLabel("Damage date").fill("2026-11-06");
  await page.getByRole("combobox", { name: "Circumstances" }).selectOption({ label: "Parking damage" });
  await page.getByRole("checkbox", { name: "Rear bumper" }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");

  await openCaseTab(page, "Documents");
  const upload = page.getByRole("form", { name: "Upload documents" });
  await upload.getByRole("combobox", { name: "Category" }).selectOption({ label: "Photo" });
  await upload.getByLabel("Files").setInputFiles({
    name: "e2e-rear-bumper.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"),
  });
  await upload.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("link", { name: "e2e-rear-bumper.png" })).toBeVisible({ timeout: 30_000 });

  // 3. The repair order (with PDF), the driver e-mail and the intermediary e-mail; then "File follow-up – repairer".
  await sendTemplate(page, "New repair order");
  await sendTemplate(page, "Driver information – repair order delivered");
  await sendTemplate(page, "New repair order – opening new file → intermediary");
  const log = page.getByRole("list", { name: "Communications" });
  await expect(log.getByRole("listitem").filter({ hasText: `New repair order ${caseNumber}` }).getByText(`repair-order-${caseNumber}.pdf`)).toBeAttached();
  await changeStatus(page, "File follow-up – repairer");

  // 4. The repairer replies with the case number in the subject: linked automatically (BR-10).
  const reply = await request.post("/api/inbound-email", {
    headers: { authorization: authorization(), "content-type": "message/rfc822" },
    data: sampleEmail("repairer-reply.eml", { DEM20260001: caseNumber, "2-DMO-001": `${plate} ${token}` }),
  });
  expect(reply.status()).toBe(200);
  const linked = (await reply.json()) as { id: string; linkedCaseNumbers: string[] };
  inboundIds.push(linked.id);
  expect(linked.linkedCaseNumbers).toEqual([caseNumber]);
  await page.goto(`/cases/${caseId}/communications?filter=email_in`);
  await expect(log).toContainText(`RE: New repair order ${caseNumber}`);

  // 5. The estimate as a pre-calculation, sent to the broker; "File follow-up – broker/insurer".
  await openCaseTab(page, "Quote");
  const pre = page.getByRole("region", { name: "Pre-calculation" });
  await pre.getByRole("button", { name: "Add line" }).click();
  await pre.getByRole("combobox", { name: "Line 1 category" }).selectOption({ label: "Parts" });
  await pre.getByRole("textbox", { name: "Line 1 description" }).fill("Rear bumper cover");
  await pre.getByRole("textbox", { name: "Line 1 amount" }).fill("640");
  await pre.getByRole("button", { name: "Add line" }).click();
  await pre.getByRole("combobox", { name: "Line 2 category" }).selectOption({ label: "Labour" });
  await pre.getByRole("combobox", { name: "Line 2 sub-type" }).selectOption({ label: "Paintwork" });
  await pre.getByRole("textbox", { name: "Line 2 description" }).fill("Paint rear bumper");
  await pre.getByRole("textbox", { name: "Line 2 amount" }).fill("360");
  await pre.getByRole("button", { name: "Save pre-calculation" }).click();
  await expect(pre.getByRole("status")).toHaveText("Pre-calculation saved.");
  await pre.getByRole("button", { name: "E-mail the estimate to the broker" }).click();
  const compose = page.getByRole("form", { name: "Compose e-mail" });
  await expect(compose.getByRole("textbox", { name: "To" })).toHaveValue(/louise\.mertens@harbourline\.example/);
  await compose.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status").filter({ hasText: "E-mail sent and logged below." })).toBeVisible();
  await openCaseTab(page, "Quote");
  await pre.getByRole("button", { name: "Mark as sent to broker" }).click();
  await expect(pre.getByText("Sent", { exact: true })).toBeVisible();
  await changeStatus(page, "File follow-up – broker/insurer");

  // 6. Copy to the post-calculation and validate as "Approval without expert": the status changes automatically (BR-03).
  const post = page.getByRole("region", { name: "Post-calculation" });
  await post.getByRole("button", { name: "Copy from pre-calculation" }).click();
  await expect(post.getByLabel("Post-calculation totals")).toContainText("Total excl. VAT€1,000.00");
  await post.getByRole("button", { name: "Validate" }).click();
  const dialog = page.getByRole("dialog", { name: "Validate the post-calculation" });
  await expect(dialog.getByRole("combobox", { name: "Assessment type" })).toHaveValue("approval_without_expert");
  await dialog.getByRole("button", { name: "Confirm validation" }).click();
  await expect(dialog).toBeHidden();
  await expect(statusBadge(page, "File follow-up – repairer (expert report OK)")).toBeVisible();

  // 7. The repairer invoice; the completeness check passes; "Invoicing – OK"; the sales invoice number closes the case.
  await openCaseTab(page, "Assessment");
  const invoiceUpload = page.getByRole("form", { name: "Upload the repairer invoice" });
  await invoiceUpload.getByLabel("Files").setInputFiles({
    name: "e2e-riverside-invoice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% e2e invoice\n"),
  });
  await invoiceUpload.getByRole("button", { name: "Upload" }).click();
  const invoice = page.getByRole("form", { name: "Repairer invoice", exact: true });
  await expect(invoice.getByRole("combobox", { name: "Invoice document" }).getByRole("option", { name: "e2e-riverside-invoice.pdf" })).toBeAttached();
  await expect(page.getByText("Expected: €870.00")).toBeVisible();
  await invoice.getByRole("checkbox", { name: "Repairer invoice received" }).check();
  await invoice.getByLabel("Received on").fill("2026-11-20");
  await invoice.getByRole("textbox", { name: "Amount excl. VAT (€)" }).fill("870");
  await invoice.getByRole("combobox", { name: "Invoice document" }).selectOption({ label: "e2e-riverside-invoice.pdf" });
  await invoice.getByRole("button", { name: "Save repairer invoice" }).click();
  await expect(invoice.getByRole("status")).toHaveText("Changes saved.");
  await expect(page.getByRole("list", { name: "Completeness check" })).not.toContainText("(missing)");
  await changeStatus(page, "Invoicing – OK");
  const sales = page.getByRole("form", { name: "Sales invoice" });
  await sales.getByRole("textbox", { name: "Sales invoice number" }).fill("SI-2026-0101");
  await sales.getByRole("button", { name: "Record the sales invoice and close the case" }).click();
  await expect(statusBadge(page, "Closed")).toBeVisible();

  // 8. The dashboard: open tasks and the new-cases trend; the draft tables ready for phase 2.
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /^My tasks: \d+ open$/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /New cases per month over the last 12 months/ })).toBeVisible();
  await expect(page.getByRole("definition").first()).toBeVisible();
  await expect(page.getByText("Ready for phase 2")).toBeVisible();
});
