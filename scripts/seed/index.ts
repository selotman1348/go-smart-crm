/**
 * Loads the fictitious seed data (scripts/seed/data.ts) into Supabase.
 * Safe to run repeatedly: existing rows are left unchanged, never overwritten.
 *
 *   npm run db:seed
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and SEED_USER_PASSWORD
 * from .env.local (or the environment).
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { buildSeed, SEED_USERS, userSignature, type SeedUserIds } from "./data";

loadEnvConfig(process.cwd());

type TableName = keyof Database["public"]["Tables"];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  }
  return value;
}

const db = createClient<Database>(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SECRET_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function ensureUsers(password: string): Promise<SeedUserIds> {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw new Error(`Could not list users: ${error.message}`);
  }
  const existing = new Map(data.users.map((user) => [user.email?.toLowerCase(), user.id]));

  const ids: Partial<SeedUserIds> = {};
  for (const user of SEED_USERS) {
    let id = existing.get(user.email);
    if (id) {
      console.log(`user     exists   ${user.email}`);
    } else {
      const { data: created, error: createError } = await db.auth.admin.createUser({
        email: user.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
      });
      if (createError) {
        throw new Error(`Could not create ${user.email}: ${createError.message}`);
      }
      id = created.user.id;
      console.log(`user     created  ${user.email}`);
    }
    ids[user.key] = id;

    // The profile row comes from the auth trigger; add the e-mail signature once.
    const { error: profileError } = await db
      .from("app_user")
      .update({ signature: userSignature(user) })
      .eq("id", id)
      .is("signature", null);
    if (profileError) {
      throw new Error(`Could not update the profile of ${user.email}: ${profileError.message}`);
    }
  }
  return ids as SeedUserIds;
}

/** Inserts rows that do not exist yet (ON CONFLICT DO NOTHING) and reports how many were new. */
async function insertMissing<T extends TableName>(
  table: T,
  rows: Database["public"]["Tables"][T]["Insert"][],
  onConflict = "id",
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const { data, error } = await db
    .from(table)
    // defaultToNull: false -> columns a row leaves out get their default, not NULL.
    .upsert(rows as never, { onConflict, ignoreDuplicates: true, defaultToNull: false })
    .select("created_at");
  if (error) {
    throw new Error(`Could not seed ${table}: ${error.message}`);
  }
  const inserted = data?.length ?? 0;
  console.log(`${table.padEnd(18)} ${String(inserted).padStart(3)} new, ${rows.length - inserted} already present`);
}

async function main() {
  const users = await ensureUsers(requireEnv("SEED_USER_PASSWORD"));
  const seed = buildSeed(users);

  // Parents before children (parent_account_id, copied_from_quote_id).
  await insertMissing("account", seed.accounts.filter((account) => !account.parent_account_id));
  await insertMissing("account", seed.accounts.filter((account) => account.parent_account_id));
  await insertMissing("contact", seed.contacts);
  await insertMissing("vehicle", seed.vehicles);
  await insertMissing("tag", seed.tags);
  await insertMissing("case", seed.cases);
  await insertMissing("case_party", seed.caseParties);
  await insertMissing("damage", seed.damages);
  await insertMissing("damaged_part", seed.damagedParts, "damage_id,part_code");
  await insertMissing("quote", seed.preQuotes);
  await insertMissing("quote", seed.postQuotes);
  await insertMissing("quote_line", seed.quoteLines);
  await insertMissing("assessment", seed.assessments);
  await insertMissing("invoice", seed.invoices);
  await insertMissing("case_tag", seed.caseTags, "case_id,tag_id");
  await insertMissing("status_history", seed.statusHistory);
  await insertMissing("event", seed.events);
  await insertMissing("audit_log", seed.auditLog);
  await insertMissing("communication", seed.communications);
  await insertMissing("case_communication", seed.caseCommunications, "case_id,communication_id");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
