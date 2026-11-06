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

/**
 * Opens a case tab and waits until the navigation has finished: until then
 * the previous tab is still on screen, with fields of the same name.
 * (Cache Components keeps visited tabs mounted but hidden, so tests locate
 * fields by role, which skips hidden elements.)
 */
export async function openCaseTab(page: Page, name: string) {
  // A tab with missing information carries a warning marker (BR-13).
  const tab = page
    .getByRole("navigation", { name: "Case sections" })
    .getByRole("link", { name: new RegExp(`^${name}( \\(missing information\\))?$`) });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-current", "page");
}

/** Signs in and lands on the dashboard. */
export async function signIn(page: Page) {
  await page.goto("/login");
  await fillLogin(page);
  // The first sign-in on a fresh dev server waits for the dashboard to compile.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
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

/** Z + three letters: never a seeded client code, and never DEM (the demo's DEM20260001 stays free). */
export function testClientCode() {
  return `Z${Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("")}`;
}

/**
 * Removes received e-mails (with their stored files, intake drafts and
 * events): those with these ids, and those whose subject contains the token.
 */
export async function removeInboundEmails(ids: string[], subjectToken?: string) {
  const db = adminClient();
  const all = new Set(ids);
  if (subjectToken) {
    const { data } = await db.from("inbound_email").select("id").like("subject", `%${subjectToken}%`);
    for (const row of data ?? []) {
      all.add(row.id);
    }
  }
  for (const id of all) {
    const [{ data: email }, { data: attachments }] = await Promise.all([
      db.from("inbound_email").select("raw_storage_path").eq("id", id).maybeSingle(),
      db.from("inbound_attachment").select("storage_path").eq("inbound_email_id", id),
    ]);
    const paths = [email?.raw_storage_path, ...(attachments ?? []).map((row) => row.storage_path)].filter(
      (path): path is string => Boolean(path),
    );
    if (paths.length > 0) {
      await db.storage.from("inbound").remove(paths);
    }
    await db.from("event").delete().eq("payload->>inboundEmailId", id);
    await db.from("inbound_email").delete().eq("id", id);
  }
}

/**
 * Removes a test client with all its cases and everything recorded about them:
 * documents (and their files), communications, received e-mails, vehicles,
 * events and audit rows.
 */
export async function removeTestClient(clientId: string, extra: { tagName?: string } = {}) {
  const db = adminClient();
  const { data: cases } = await db.from("case").select("id").eq("client_account_id", clientId);
  await removeCases((cases ?? []).map((row) => row.id));
  if (extra.tagName) {
    await db.from("tag").delete().eq("name", extra.tagName);
  }
  await db.from("account").delete().eq("id", clientId);
}

/** Removes test cases with everything recorded about them (see removeTestClient). */
export async function removeCases(ids: string[]) {
  const db = adminClient();
  const { data: cases } = await db.from("case").select("id, vehicle_id").in("id", ids);
  const caseIds = (cases ?? []).map((row) => row.id);
  const vehicleIds = (cases ?? []).map((row) => row.vehicle_id).filter((id): id is string => Boolean(id));
  if (caseIds.length > 0) {
    const [{ data: documents }, { data: damages }, { data: quotes }] = await Promise.all([
      db.from("document").select("storage_path").in("case_id", caseIds),
      db.from("damage").select("id").in("case_id", caseIds),
      db.from("quote").select("id").in("case_id", caseIds),
    ]);
    if (documents?.length) {
      await db.storage.from("documents").remove(documents.map((row) => row.storage_path));
    }
    const childIds = [...(damages ?? []), ...(quotes ?? [])].map((row) => row.id);
    const [{ data: links }, { data: inbound }] = await Promise.all([
      db.from("case_communication").select("communication_id").in("case_id", caseIds),
      db.from("inbound_email").select("id").in("linked_case_id", caseIds),
    ]);
    await removeInboundEmails((inbound ?? []).map((row) => row.id));
    await db.from("event").delete().in("case_id", caseIds);
    await db.from("audit_log").delete().in("case_id", caseIds);
    await db.from("case").delete().in("id", caseIds);
    const communicationIds = (links ?? []).map((row) => row.communication_id);
    if (communicationIds.length > 0) {
      await db.from("communication").delete().in("id", communicationIds);
    }
    // Audit rows written while deleting no longer point to the case.
    await db.from("audit_log").delete().is("case_id", null).in("entity_id", [...caseIds, ...childIds]);
    for (const id of [...caseIds, ...childIds]) {
      await db.from("audit_log").delete().is("case_id", null).like("old_value", `%${id}%`);
    }
  }
  if (vehicleIds.length > 0) {
    await db.from("vehicle").delete().in("id", vehicleIds);
    await db.from("audit_log").delete().eq("entity", "vehicle").in("entity_id", vehicleIds);
  }
}
