import { expect, test, type Page } from "@playwright/test";

import type { CaseStatus } from "../src/domain/cases/case-status";

import {
  adminClient,
  openCaseTab,
  removeTestClient,
  requireCredentials,
  signIn,
  testClientCode,
  testName,
} from "./helpers";

// Iteration 3 main flow: estimate → approval → automatic status (BR-03), with
// and without an expert, plus no repair (BR-07) and total loss (UC-26).
// The test cases belong to a test client that is removed afterwards.
test.describe.configure({ mode: "serial" });

const clientCode = testClientCode();
let clientId = "";
const caseIds: Record<"approval" | "expert" | "noRepair" | "totalLoss", string> = {
  approval: "",
  expert: "",
  noRepair: "",
  totalLoss: "",
};
const VALIDATED = "File follow-up – repairer (expert report OK)";

test.beforeAll(async () => {
  requireCredentials();
  const db = adminClient();
  const { data: client, error } = await db
    .from("account")
    .insert({ name: testName("Quote client"), account_type: ["client"], client_code: clientCode })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Could not create the test client: ${error.message}`);
  }
  clientId = client.id;

  const cases: [keyof typeof caseIds, CaseStatus][] = [
    ["approval", "followup_broker_insurer"],
    ["expert", "followup_expert"],
    ["noRepair", "followup_broker_insurer"],
    ["totalLoss", "followup_expert"],
  ];
  for (const [index, [key, status]] of cases.entries()) {
    const { data, error: caseError } = await db
      .from("case")
      .insert({ case_number: `${clientCode}2026000${index + 1}`, client_account_id: clientId, status })
      .select("id")
      .single();
    if (caseError) {
      throw new Error(`Could not create a test case: ${caseError.message}`);
    }
    caseIds[key] = data.id;
    await db.from("case_party").insert({ case_id: data.id, role: "owner_fleet_owner", account_id: clientId });
  }
  const { data: expert } = await db.from("account").select("id").eq("name", "Precision Claims Experts BV").single();
  await db.from("case_party").insert({ case_id: caseIds.expert, role: "expert", account_id: expert!.id });
});

test.afterAll(async () => {
  await removeTestClient(clientId);
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

const statusBadge = (page: Page, label: string) =>
  page.locator('header [data-slot="badge"]').filter({ hasText: new RegExp(`^${label.replace(/[()]/g, "\\$&")}$`) });

async function addLine(page: Page, editor: string, index: number, line: { category: string; subType?: string; description: string; amount: string }) {
  const section = page.getByRole("region", { name: editor });
  await section.getByRole("button", { name: "Add line" }).click();
  await section.getByRole("combobox", { name: `Line ${index} category` }).selectOption({ label: line.category });
  if (line.subType) {
    await section.getByRole("combobox", { name: `Line ${index} sub-type` }).selectOption({ label: line.subType });
  }
  await section.getByRole("textbox", { name: `Line ${index} description` }).fill(line.description);
  await section.getByRole("textbox", { name: `Line ${index} amount` }).fill(line.amount);
}

test("estimate, copy and approval without expert change the status automatically (BR-03)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/cases/${caseIds.approval}/quote`);
  const pre = page.getByRole("region", { name: "Pre-calculation" });

  // UC-18: lines with categories and sub-types; live subtotals and total.
  await addLine(page, "Pre-calculation", 1, { category: "Labour", subType: "Paintwork", description: "Paint rear bumper", amount: "248" });
  await addLine(page, "Pre-calculation", 2, { category: "Parts", description: "Rear bumper cover", amount: "412,30" });
  await addLine(page, "Pre-calculation", 3, { category: "Deduction", subType: "Wear and tear", description: "Wear", amount: "50" });
  const totals = pre.getByRole("definition");
  await expect(pre.getByLabel("Pre-calculation totals")).toContainText("Labour€248.00Parts€412.30Deduction-€50.00Total excl. VAT€610.30");
  await expect(totals.last()).toHaveText("€610.30");
  await pre.getByRole("button", { name: "Save pre-calculation" }).click();
  await expect(pre.getByRole("status")).toHaveText("Pre-calculation saved.");

  // UC-20: the estimate went to the broker.
  await pre.getByRole("button", { name: "Mark as sent to broker" }).click();
  await expect(pre.getByText("Sent", { exact: true })).toBeVisible();

  // UC-21: one action copies all lines.
  const post = page.getByRole("region", { name: "Post-calculation" });
  await post.getByRole("button", { name: "Copy from pre-calculation" }).click();
  await expect(post.getByRole("textbox", { name: "Line 3 description" })).toHaveValue("Wear");
  await expect(post.getByLabel("Post-calculation totals")).toContainText("Total excl. VAT€610.30");

  // UC-22: the Validate dialog.
  await post.getByRole("button", { name: "Validate" }).click();
  const dialog = page.getByRole("dialog", { name: "Validate the post-calculation" });
  await expect(dialog.getByRole("combobox", { name: "Assessment type" })).toHaveValue("approval_without_expert");
  await expect(dialog.getByRole("textbox", { name: "Approved amount excl. VAT (€)" })).toHaveValue("610,30");
  await expect(dialog.getByText("€738.46")).toBeVisible();
  await dialog.getByRole("textbox", { name: "Loss-of-use days" }).fill("2");
  await dialog.getByRole("button", { name: "Confirm validation" }).click();
  await expect(dialog).toBeHidden();

  // BR-03: the status changed automatically; the validated quote is read-only.
  await expect(statusBadge(page, VALIDATED)).toBeVisible();
  await expect(post.getByText("Validated", { exact: true })).toBeVisible();
  await expect(post.getByRole("button", { name: "Save post-calculation" })).toBeHidden();

  await openCaseTab(page, "Assessment");
  await expect(page.getByText("Approval without expert")).toBeVisible();
  await expect(page.getByText("€738.46")).toBeVisible();

  await openCaseTab(page, "History");
  const history = page.getByRole("list", { name: "Case history" });
  const statusEntry = history.getByRole("listitem").filter({ hasText: "Changed the status" }).first();
  await expect(statusEntry).toContainText("System");
  await expect(statusEntry).toContainText(VALIDATED);
  await expect(history.getByText("Validated the post-calculation")).toBeVisible();
  await expect(history.getByText("Created the pre-calculation")).toBeVisible();
});

test("an expert assessment is validated as Smart Expertise after the report check (BR-04, BR-06)", async ({ page }) => {
  test.setTimeout(120_000);
  // UC-24: the expert report is stored under Assessment.
  await page.goto(`/cases/${caseIds.expert}/assessment`);
  const upload = page.getByRole("form", { name: "Upload the expert report or the client's purchase order" });
  await upload.getByLabel("Files").setInputFiles({
    name: "e2e-expert-report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% e2e expert report\n"),
  });
  await upload.getByRole("button", { name: "Upload" }).click();
  const reportSelect = page.getByRole("combobox", { name: "Expert report" });
  await expect(reportSelect.getByRole("option", { name: "e2e-expert-report.pdf" })).toBeAttached();
  await page.getByRole("combobox", { name: "Expert", exact: true }).selectOption({ label: "Precision Claims Experts BV" });
  await reportSelect.selectOption({ label: "e2e-expert-report.pdf" });
  await page.getByRole("button", { name: "Save expert assessment" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toBeVisible();

  // The expert's figures go straight into the post-calculation.
  await openCaseTab(page, "Quote");
  await addLine(page, "Post-calculation", 1, { category: "Labour", subType: "Assembly / disassembly", description: "Replace door", amount: "500" });
  const post = page.getByRole("region", { name: "Post-calculation" });
  await post.getByRole("button", { name: "Save post-calculation" }).click();
  await expect(post.getByRole("status")).toHaveText("Post-calculation saved.");

  await post.getByRole("button", { name: "Validate" }).click();
  const dialog = page.getByRole("dialog", { name: "Validate the post-calculation" });
  await expect(dialog.getByText("e2e-expert-report.pdf")).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Assessment type" })).toHaveValue("on_site");
  await dialog.getByRole("checkbox", { name: /assessed the damage remotely/ }).check();
  await expect(dialog.getByRole("combobox", { name: "Assessment type" })).toHaveValue("smart_expertise");
  await dialog.getByRole("textbox", { name: "Loss-of-use days" }).fill("4");

  // BR-06: the report must be checked against the case.
  await dialog.getByRole("button", { name: "Confirm validation" }).click();
  await expect(dialog.getByText("Confirm that the expert report matches this case's damage (BR-06).")).toBeVisible();
  await dialog.getByRole("checkbox", { name: /report's remarks match/ }).check();
  await dialog.getByRole("button", { name: "Confirm validation" }).click();
  await expect(dialog).toBeHidden();
  await expect(statusBadge(page, VALIDATED)).toBeVisible();

  await openCaseTab(page, "Assessment");
  await expect(page.getByText("Smart Expertise")).toBeVisible();
});

test("no repair needs a reason and closes the case (BR-07)", async ({ page }) => {
  await page.goto(`/cases/${caseIds.noRepair}/assessment`);
  const section = page.getByRole("region", { name: "No repair (UC-27)" });
  await section.getByRole("button", { name: "Record no repair and close the case" }).click();
  await expect(section.getByText("Choose why the repair is cancelled (BR-07).")).toBeVisible();
  await expect(section.getByText("Confirm that the repairer was told not to start the repair (BR-07).")).toBeVisible();

  await section.getByRole("combobox", { name: "Reason" }).selectOption({ label: "Cash settlement" });
  await section.getByRole("checkbox", { name: /repairer has been told/ }).check();
  await section.getByRole("button", { name: "Record no repair and close the case" }).click();
  await expect(statusBadge(page, "Closed")).toBeVisible();
  await expect(page.getByRole("region", { name: "No repair" })).toContainText("Cash settlement");
});

test("a total loss proposes the damage amount and closes the case (UC-26)", async ({ page }) => {
  await page.goto(`/cases/${caseIds.totalLoss}/assessment`);
  const section = page.getByRole("region", { name: "Total loss (UC-26)" });
  await section.getByRole("textbox", { name: "Vehicle value before the incident (€)" }).fill("18.500");
  await section.getByRole("textbox", { name: "Deduction for previous damage (€)" }).fill("750");
  await section.getByRole("textbox", { name: "Wreck value (€)" }).fill("3200,50");
  await expect(section.getByText("Proposed: €14,549.50.", { exact: false })).toBeVisible();
  await section.getByRole("button", { name: "Record total loss and close the case" }).click();

  await expect(statusBadge(page, "Closed")).toBeVisible();
  await expect(page.getByRole("region", { name: "Total loss" })).toContainText("€14,549.50");
});
