import { expect, test, type Page } from "@playwright/test";

import { adminClient, requireCredentials, signIn, testName } from "./helpers";

// Iteration 2 main flow: a case is created, completed end to end and its
// status changed with history (plan.md section 4). Uses the seed data for
// browsing; everything the test creates is removed afterwards.
// Cache Components keeps visited tabs mounted but hidden, so fields are
// located by role, which skips hidden elements.
test.describe.configure({ mode: "serial" });

const clientName = testName("Client");
// Z + three letters: never one of the seeded client codes, and never DEM, so
// the demo's DEM20260001 stays free.
const clientCode = `Z${Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("")}`;
const plate = `9-ZE${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${String(Math.floor(Math.random() * 900) + 100)}`;
const tagName = testName("tag");
let clientId = "";

test.beforeAll(async () => {
  requireCredentials();
  const db = adminClient();
  const { data, error } = await db
    .from("account")
    .insert({ name: clientName, account_type: ["client"], client_code: clientCode })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Could not create the test client: ${error.message}`);
  }
  clientId = data.id;
});

test.afterAll(async () => {
  const db = adminClient();
  const { data: cases } = await db.from("case").select("id, vehicle_id").eq("client_account_id", clientId);
  const caseIds = (cases ?? []).map((row) => row.id);
  const vehicleIds = (cases ?? []).map((row) => row.vehicle_id).filter((id): id is string => Boolean(id));
  if (caseIds.length > 0) {
    const { data: documents } = await db.from("document").select("storage_path").in("case_id", caseIds);
    if (documents?.length) {
      await db.storage.from("documents").remove(documents.map((row) => row.storage_path));
    }
    const { data: damages } = await db.from("damage").select("id").in("case_id", caseIds);
    const damageIds = (damages ?? []).map((row) => row.id);
    await db.from("event").delete().in("case_id", caseIds);
    await db.from("audit_log").delete().in("case_id", caseIds);
    await db.from("case").delete().in("id", caseIds);
    // Audit rows written while deleting no longer point to the case.
    await db.from("audit_log").delete().is("case_id", null).in("entity_id", [...caseIds, ...damageIds]);
    for (const caseId of caseIds) {
      await db.from("audit_log").delete().is("case_id", null).like("old_value", `%${caseId}%`);
    }
  }
  if (vehicleIds.length > 0) {
    await db.from("vehicle").delete().in("id", vehicleIds);
    await db.from("audit_log").delete().eq("entity", "vehicle").in("entity_id", vehicleIds);
  }
  await db.from("tag").delete().eq("name", tagName);
  await db.from("account").delete().eq("id", clientId);
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

async function openTab(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Case sections" }).getByRole("link", { name, exact: true }).click();
}

test("searches and filters the seeded cases", async ({ page }) => {
  await page.goto("/cases");
  await expect(page.getByRole("link", { name: /All open cases/ })).toBeVisible();

  // One plate, written differently, finds its case (UC-05).
  await page.getByLabel("Search cases").fill("9tka101");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: "VCR20260001" })).toBeVisible();
  await expect(page.getByRole("link", { name: "VCR20260002" })).toBeHidden();

  // Filter by status (UC-06).
  await page.getByRole("link", { name: "Reset filters" }).click();
  await expect(page).toHaveURL(/\/cases$/);
  await page.getByLabel("Status", { exact: true }).selectOption("closed");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: "DEM20250001" })).toBeVisible();
  await expect(page.getByRole("link", { name: "VCR20260001" })).toBeHidden();

  // A client tile shows that client's open cases (UC-04).
  await page
    .getByRole("navigation", { name: "Open cases per client" })
    .getByRole("link", { name: /Velora Fleet Services NV/ })
    .click();
  await expect(page).toHaveURL(/status=open&client=/);
  await expect(page.getByRole("link", { name: "VFS20260001" })).toBeVisible();
  await expect(page.getByRole("link", { name: "VCR20260001" })).toBeHidden();
});

test("marks missing VDA and PO numbers for a client that requires them (BR-11)", async ({ page }) => {
  await page.goto("/cases?q=VCR20260005");
  await page.getByRole("link", { name: "VCR20260005" }).click();
  await expect(page.getByText("This client requires a VDA and a PO number (BR-11).")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Case sections" }).getByRole("link", { name: /Case \(missing information\)/ }),
  ).toBeVisible();
});

test("creates a case, completes it, changes its status and shows the history", async ({ page }) => {
  test.setTimeout(120_000);
  // UC-08: create with only the client; the number is generated (BR-01).
  await page.goto("/cases/new");
  await page.getByLabel("Client").selectOption({ label: clientName });
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByRole("heading", { name: `${clientCode}20260001` })).toBeVisible();
  await expect(page.getByText("Client assignment").first()).toBeVisible();
  const caseUrl = page.url();

  // Case tab: references, on hold with a reason, a new tag (UC-09, UC-28).
  await page.getByRole("textbox", { name: "Insurer ref." }).fill("E2E-INS-1");
  await page.getByRole("checkbox", { name: "Put the case on hold" }).check();
  await page.getByRole("combobox", { name: "Reason" }).selectOption({ label: "Awaiting parts" });
  await page.getByRole("textbox", { name: "Note" }).fill("Bumper on back order");
  await page.getByRole("textbox", { name: "New tag" }).fill(tagName);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await expect(page.getByText("On hold", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: tagName })).toBeChecked();

  // Vehicle tab (UC-10).
  await openTab(page, "Vehicle");
  await page.getByRole("textbox", { name: "Licence plate", exact: true }).fill(plate);
  await page.getByRole("textbox", { name: "Make" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Model", exact: true }).fill("Yaris");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await expect(page.getByText(`${plate} · Toyota Yaris`)).toBeVisible();

  // Parties tab (UC-11): the client is already the owner/fleet owner (BR-02).
  await openTab(page, "Parties");
  await expect(page.getByRole("row", { name: /Owner \/ fleet owner Invoice party/ })).toBeVisible();
  await page.getByRole("combobox", { name: "Role" }).selectOption("repairer");
  await page.getByRole("combobox", { name: "Account", exact: true }).selectOption({ label: "Riverside Body Shop BV" });
  await page.getByRole("combobox", { name: "Contact person (optional)" }).selectOption({ label: "Kevin Pauwels" });
  await page.getByRole("button", { name: "Add party" }).click();
  await expect(page.getByRole("row", { name: /Repairer Riverside Body Shop BV Kevin Pauwels/ })).toBeVisible();

  // Damage tab (UC-12).
  await openTab(page, "Damage");
  await page.getByLabel("Damage date").filter({ visible: true }).fill("2026-11-03");
  await page.getByRole("combobox", { name: "Circumstances" }).selectOption({ label: "Parking damage" });
  await page.getByRole("textbox", { name: "Cause" }).fill("Bumper scraped in a car park.");
  await page.getByRole("checkbox", { name: "Front bumper" }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");

  // Documents tab (UC-36): upload, download, remove.
  await openTab(page, "Documents");
  await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Claim form" });
  await page.getByLabel("Files").filter({ visible: true }).setInputFiles({
    name: "e2e-claim.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% e2e test file\n"),
  });
  await page.getByRole("button", { name: "Upload" }).click();
  // The lasting outcome: the file is listed with its category.
  const link = page.getByRole("link", { name: "e2e-claim.pdf" });
  await expect(link).toBeVisible();
  await expect(page.getByRole("row", { name: /e2e-claim\.pdf Claim form/ })).toBeVisible();
  const download = await page.request.get((await link.getAttribute("href"))!);
  expect(download.ok()).toBe(true);
  expect((await download.body()).toString()).toContain("%PDF-1.4");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Remove e2e-claim.pdf" }).click();
  await expect(link).toBeHidden();

  // Status change through the status engine.
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption({ label: "File follow-up – repairer" });
  await page.getByRole("button", { name: "Change status" }).click();
  await expect(
    page.locator('header [data-slot="badge"]').filter({ hasText: /^File follow-up – repairer$/ }),
  ).toBeVisible();

  // History tab (UC-37): every change, newest first.
  await openTab(page, "History");
  const history = page.getByRole("list", { name: "Case history" });
  for (const text of [
    "Changed the status",
    "Removed document e2e-claim.pdf (Claim form)",
    "Uploaded document e2e-claim.pdf (Claim form)",
    "Added damaged part: Front bumper",
    "Added party Repairer: Riverside Body Shop BV – Kevin Pauwels",
    `Added vehicle ${plate}`,
    `Added tag ${tagName}`,
    "Updated the case",
    `Created the case ${clientCode}20260001`,
  ]) {
    // "Updated the case" appears for the header save and for linking the vehicle.
    await expect(history.getByText(text, { exact: true }).first()).toBeVisible();
  }
  await expect(history.getByText("Client assignment").first()).toBeVisible();

  // The case is found by its plate.
  await page.goto(`/cases?q=${encodeURIComponent(plate.replace(/-/g, " "))}`);
  await page.getByRole("link", { name: `${clientCode}20260001` }).click();
  await expect(page).toHaveURL(caseUrl);
});
