import { expect, test } from "@playwright/test";

import { E2E_EMAIL, E2E_PASSWORD, fillLogin, requireCredentials } from "./helpers";

// UC-01 Log in.
test.beforeAll(requireCredentials);

test("sends a signed-out user to the login page", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to Go Smart CRM" }),
  ).toBeVisible();
});

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/login");

  await fillLogin(page, `${E2E_PASSWORD}-wrong`);

  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid e-mail or password." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("E-mail")).toHaveValue(E2E_EMAIL);
});

test("signs in to the dashboard and signs out again", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  await fillLogin(page);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Alex Morgan")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});
