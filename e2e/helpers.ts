import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

import type { Database } from "../src/lib/supabase/database.types";

// A seeded user (npm run db:seed); see .env.example.
export const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? "";
export const E2E_PASSWORD = process.env.SEED_USER_PASSWORD ?? "";

export function requireCredentials() {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Set E2E_USER_EMAIL and SEED_USER_PASSWORD (see .env.example) and run npm run db:seed.",
    );
  }
}

export async function fillLogin(page: Page, password = E2E_PASSWORD) {
  await page.getByLabel("E-mail").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in and lands on the dashboard. */
export async function signIn(page: Page) {
  await page.goto("/login");
  await fillLogin(page);
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Service-role client for cleaning up test records; bypasses row-level security. */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to clean up test data.");
  }
  return createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Unique, recognisable name for records created by a test run. */
export function testName(label: string) {
  return `E2E ${label} ${Date.now().toString(36)}`;
}
