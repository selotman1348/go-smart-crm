import { expect, test, type Page } from "@playwright/test";

// UC-01 Log in. Uses a user created by `npm run db:seed`.
const email = process.env.E2E_USER_EMAIL ?? "";
const password = process.env.SEED_USER_PASSWORD ?? "";

test.beforeAll(() => {
  if (!email || !password) {
    throw new Error(
      "Set E2E_USER_EMAIL and SEED_USER_PASSWORD (see .env.example) and run npm run db:seed.",
    );
  }
});

async function signIn(page: Page, withPassword: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(withPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("sends a signed-out user to the login page", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to Go Smart CRM" }),
  ).toBeVisible();
});

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/login");

  await signIn(page, `${password}-wrong`);

  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid e-mail or password." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
});

test("signs in to the dashboard and signs out again", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, password);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Alex Morgan")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});
