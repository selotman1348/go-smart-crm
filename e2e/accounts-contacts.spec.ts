import { expect, test } from "@playwright/test";

import { adminClient, requireCredentials, signIn, testName } from "./helpers";

// UC-38 Manage accounts and contacts. Uses the seed data (npm run db:seed);
// records created here are named "E2E …" and removed afterwards.
test.describe.configure({ mode: "serial" });

const createdAccountIds: string[] = [];

test.beforeAll(requireCredentials);

test.afterAll(async () => {
  if (createdAccountIds.length === 0) {
    return;
  }
  const db = adminClient();
  await db.from("contact").delete().in("account_id", createdAccountIds);
  await db.from("account").delete().in("id", createdAccountIds);
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("browses, searches and filters the seeded accounts", async ({ page }) => {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Accounts" }).click();
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Velora Car Rental NV" })).toBeVisible();

  await page.getByLabel("Search accounts").fill("vcr");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=vcr/);
  await expect(page.getByRole("link", { name: "Velora Car Rental NV" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Riverside Body Shop BV" })).toBeHidden();

  await page.getByRole("link", { name: "Reset" }).click();
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByLabel("Search accounts")).toHaveValue("");
  await page.getByLabel("Account type").selectOption("repairer");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/type=repairer/);
  await expect(page.getByRole("link", { name: "Riverside Body Shop BV" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Velora Car Rental NV" })).toBeHidden();

  // An account shows its settings and contacts.
  await page.getByRole("link", { name: "Riverside Body Shop BV" }).click();
  await expect(page.getByRole("heading", { name: "Riverside Body Shop BV" })).toBeVisible();
  await expect(page.getByLabel("Discount (%)")).toHaveValue("13");
  await expect(page.getByRole("link", { name: "Kevin Pauwels" })).toBeVisible();
});

test("a client needs a client code", async ({ page }) => {
  await page.goto("/accounts/new");
  await page.getByLabel("Name").fill(testName("Client"));
  await page.getByLabel("Client", { exact: true }).check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("A client needs a client code; it starts every case number.")).toBeVisible();
  await expect(page).toHaveURL(/\/accounts\/new$/);
  // The entered values are kept.
  await expect(page.getByLabel("Client", { exact: true })).toBeChecked();
});

test("creates and edits an account, then adds and edits a contact", async ({ page }) => {
  const accountName = testName("Repairer");

  // Create a repairer account.
  await page.goto("/accounts/new");
  await page.getByLabel("Name").fill(accountName);
  await page.getByLabel("Repairer", { exact: true }).check();
  await page.getByLabel("Discount (%)").fill("13");
  await page.getByLabel("Member of the repair network").check();
  await page.getByLabel("City").fill("Antwerpen");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: accountName })).toBeVisible();
  const accountId = page.url().split("/").at(-1)!;
  createdAccountIds.push(accountId);

  // Edit it.
  await page.getByLabel("City").fill("Mechelen");
  await page.getByLabel("Discount (%)").fill("12,5");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.reload();
  await expect(page.getByLabel("City")).toHaveValue("Mechelen");
  await expect(page.getByLabel("Discount (%)")).toHaveValue("12.5");
  await expect(page.getByLabel("Member of the repair network")).toBeChecked();

  // Add a contact from the account page; the account is preselected.
  await page.getByRole("link", { name: "Add contact" }).click();
  await expect(page).toHaveURL(/\/contacts\/new\?accountId=/);
  await expect(page.getByLabel("Account", { exact: true })).toHaveValue(accountId);
  await page.getByLabel("First name").fill("Tess");
  await page.getByLabel("Last name").fill("Example");
  await page.getByLabel("E-mail").fill("tess.example@e2e.example");
  await page.getByRole("button", { name: "Create contact" }).click();
  await expect(page.getByRole("heading", { name: "Tess Example" })).toBeVisible();

  // Find it in Contacts and edit it.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Contacts" }).click();
  await page.getByLabel("Search contacts").fill("tess.example@e2e");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: "Tess Example" }).click();
  await page.getByLabel("Phone").fill("+32 3 000 99 99");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");

  // The contact is listed on its account.
  await page.getByRole("link", { name: accountName }).click();
  await expect(page.getByRole("link", { name: "Tess Example" })).toBeVisible();
});
