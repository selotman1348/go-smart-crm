import { expect, test, type Page } from "@playwright/test";

import { generateApiKey, hashApiKey } from "../src/domain/api/api-keys";

import {
  adminClient,
  openCaseTab,
  removeTestClient,
  requireCredentials,
  signIn,
  testClientCode,
  testName,
} from "./helpers";

// Iteration 5 main flow (demo script step 7): repairer invoice → completeness
// check (BR-08) → "Invoicing – OK" → sales invoice number → closed. Plus
// tasks, the dashboard, the agent API and the placeholder pages.
test.describe.configure({ mode: "serial" });

const clientCode = testClientCode();
const caseNumber = `${clientCode}20260001`;
const token = `E2E-${Date.now().toString(36)}`;
let clientId = "";
let caseId = "";
const apiClientIds: string[] = [];

test.beforeAll(async () => {
  requireCredentials();
  const db = adminClient();
  const { data: client, error } = await db
    .from("account")
    .insert({ name: testName("Invoicing client"), account_type: ["client"], client_code: clientCode })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Could not create the test client: ${error.message}`);
  }
  clientId = client.id;
  const { data: created, error: caseError } = await db
    .from("case")
    .insert({ case_number: caseNumber, client_account_id: clientId, status: "followup_repairer_report_ok" })
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
  // The estimate and the approval (iteration 3), as the case would have them.
  const { data: pre } = await db
    .from("quote")
    .insert({ case_id: caseId, version: "pre_calculation", origin: "repairer", status: "sent", total_excl_vat: 1000 })
    .select("id")
    .single();
  await db.from("quote_line").insert({ quote_id: pre!.id, category: "parts", description: "Rear bumper", amount: 1000 });
  await db.from("assessment").insert({
    case_id: caseId,
    assessment_type: "approval_without_expert",
    vat_applicable: true,
    approved_amount_excl_vat: 1000,
    approved_amount_incl_vat: 1210,
    validated_at: new Date().toISOString(),
  });
});

test.afterAll(async () => {
  const db = adminClient();
  await removeTestClient(clientId);
  if (apiClientIds.length > 0) {
    await db.from("audit_log").delete().in("actor_id", apiClientIds);
    await db.from("api_client").delete().in("id", apiClientIds);
  }
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

async function changeStatus(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption({ label });
  await page.getByRole("button", { name: "Change status" }).click();
}

const statusBadge = (page: Page, label: string) =>
  page.locator('header [data-slot="badge"]').filter({ hasText: new RegExp(`^${label}$`) });

test("the repairer invoice, the completeness check and the sales invoice close the case (BR-08)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/cases/${caseId}`);
  await changeStatus(page, "Invoicing – other");
  await expect(statusBadge(page, "Invoicing – other")).toBeVisible();

  // BR-08: not yet "Invoicing – OK" without the repairer invoice.
  await changeStatus(page, "Invoicing – OK");
  await expect(page.getByRole("alert").filter({ hasText: "needs: Repairer invoice (BR-08)" })).toBeVisible();
  await expect(statusBadge(page, "Invoicing – other")).toBeVisible();
  // BR-13: the tab where the missing item belongs is marked.
  await expect(
    page.getByRole("navigation", { name: "Case sections" }).getByRole("link", { name: "Assessment (missing information)" }),
  ).toBeVisible();

  await openCaseTab(page, "Assessment");
  const checklist = page.getByRole("list", { name: "Completeness check" });
  await expect(checklist).toContainText("Repairer invoice (missing)");
  await expect(page.getByText("Expected: €870.00")).toBeVisible();

  // UC-29: upload the invoice and register it.
  const upload = page.getByRole("form", { name: "Upload the repairer invoice" });
  await upload.getByLabel("Files").setInputFiles({
    name: "e2e-repairer-invoice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% e2e invoice\n"),
  });
  await upload.getByRole("button", { name: "Upload" }).click();
  const form = page.getByRole("form", { name: "Repairer invoice", exact: true });
  await expect(form.getByRole("combobox", { name: "Invoice document" }).getByRole("option", { name: "e2e-repairer-invoice.pdf" })).toBeAttached();
  await form.getByRole("checkbox", { name: "Repairer invoice received" }).check();
  await form.getByLabel("Received on").fill("2026-11-05");
  await form.getByRole("textbox", { name: "Repairer's invoice number" }).fill("RB-2026-118");
  await form.getByRole("textbox", { name: "Amount excl. VAT (€)" }).fill("870,00");
  await form.getByRole("combobox", { name: "Invoice document" }).selectOption({ label: "e2e-repairer-invoice.pdf" });
  await form.getByRole("button", { name: "Save repairer invoice" }).click();
  await expect(form.getByRole("status")).toHaveText("Changes saved.");
  await expect(checklist).not.toContainText("(missing)");

  await changeStatus(page, "Invoicing – OK");
  await expect(statusBadge(page, "Invoicing – OK")).toBeVisible();

  // UC-31: the sales invoice number from accounting closes the case.
  const sales = page.getByRole("form", { name: "Sales invoice" });
  await sales.getByRole("textbox", { name: "Sales invoice number" }).fill("SI-2026-0042");
  await sales.getByRole("button", { name: "Record the sales invoice and close the case" }).click();
  await expect(statusBadge(page, "Closed")).toBeVisible();
  await expect(page.getByRole("region", { name: "Invoicing" })).toContainText("SI-2026-0042");

  await openCaseTab(page, "History");
  const history = page.getByRole("list", { name: "Case history" });
  await expect(history.getByText("Recorded the sales invoice SI-2026-0042")).toBeVisible();
  await expect(history.getByText("Recorded the repairer invoice")).toBeVisible();
});

test("a task is added, counted on the dashboard and marked as done (UC-02, UC-03)", async ({ page }) => {
  const title = `Chase the courtesy car ${token}`;
  await page.goto("/dashboard");
  const counter = page.getByRole("link", { name: /^Broker: \d+ open$/ });
  const before = Number((await counter.getAttribute("aria-label"))?.match(/(\d+) open/)?.[1]);
  await expect(page.getByRole("img", { name: /New cases per month over the last 12 months/ })).toBeVisible();
  await expect(page.getByRole("definition").first()).toBeVisible();

  await page.goto("/tasks");
  const form = page.getByRole("form", { name: "New task" });
  await form.getByRole("textbox", { name: "Task" }).fill(title);
  await form.getByRole("combobox", { name: "Category" }).selectOption({ label: "Broker" });
  await form.getByRole("textbox", { name: "Case number" }).fill(caseNumber);
  await form.getByRole("button", { name: "Add task" }).click();
  await expect(form.getByRole("status")).toHaveText("Changes saved.");
  const item = page.getByRole("list", { name: "Tasks" }).getByRole("listitem").filter({ hasText: title });
  await expect(item).toContainText(caseNumber);

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: `Broker: ${before + 1} open` })).toBeVisible();

  await page.goto("/tasks?category=broker");
  await page.getByRole("button", { name: `Mark as done: ${title}` }).click();
  await expect(page.getByRole("list", { name: "Tasks" }).getByText(title)).toBeHidden();
});

test("an agent reads the case and drafts an e-mail; it cannot do more (plan.md section 3)", async ({ page, request }) => {
  const db = adminClient();
  const draftKey = generateApiKey();
  const readKey = generateApiKey();
  const { data: clients, error } = await db
    .from("api_client")
    .insert([
      { name: `${token} agent`, scopes: ["cases:read", "drafts:write"], key_hash: hashApiKey(draftKey) },
      { name: `${token} reader`, scopes: ["cases:read"], key_hash: hashApiKey(readKey) },
    ])
    .select("id");
  if (error) {
    throw new Error(`Could not create the API clients: ${error.message}`);
  }
  apiClientIds.push(...clients.map((client) => client.id));

  expect((await request.get(`/api/v1/cases/${caseNumber}`)).status()).toBe(401);
  const read = await request.get(`/api/v1/cases/${caseNumber}`, { headers: { authorization: `Bearer ${readKey}` } });
  expect(read.status()).toBe(200);
  expect((await read.json()).case).toMatchObject({ caseNumber, status: "closed" });

  const draft = { to: ["info@riverside-bodyshop.example"], subject: `Missing photos ${token}`, body: "Please send the photos." };
  expect((await request.post(`/api/v1/cases/${caseNumber}/email-drafts`, { headers: { authorization: `Bearer ${readKey}` }, data: draft })).status()).toBe(403);
  const created = await request.post(`/api/v1/cases/${caseNumber}/email-drafts`, {
    headers: { authorization: `Bearer ${draftKey}` },
    data: draft,
  });
  expect(created.status()).toBe(201);
  expect(await created.json()).toMatchObject({ status: "draft" });

  // A human reviews the draft; the History shows who wrote it.
  await page.goto(`/cases/${caseId}/communications`);
  await expect(page.getByRole("link", { name: `Missing photos ${token}` })).toBeVisible();
  await openCaseTab(page, "History");
  const entry = page.getByRole("list", { name: "Case history" }).getByRole("listitem").filter({ hasText: `Drafted an e-mail: Missing photos ${token}` });
  await expect(entry).toContainText("API client");
});

test("the menu has placeholder pages for what is not in version 1", async ({ page }) => {
  for (const [label, heading] of [
    ["Leads", "Leads"],
    ["Notes", "Notes"],
    ["Surveys", "Surveys"],
    ["Network", "Repair network"],
  ] as const) {
    await page.goto("/dashboard");
    await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("Not part of version 1")).toBeVisible();
  }
});
