/**
 * Creates an API client for an external agent (plan.md section 3) and prints
 * its key once; only the key's hash is stored.
 *
 *   npm run api:key -- "Intake agent" cases:read,drafts:write
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local.
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { generateApiKey, hashApiKey, parseScopes } from "../src/domain/api/api-keys";

loadEnvConfig(process.cwd());

async function main() {
  const [name, scopeText = "cases:read,drafts:write"] = process.argv.slice(2);
  if (!name?.trim()) {
    throw new Error('Usage: npm run api:key -- "<name>" [cases:read,drafts:write]');
  }
  const scopes = parseScopes(scopeText);
  if (!scopes.ok) {
    throw new Error(scopes.error);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
  }
  const db = createClient<Database>(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const key = generateApiKey();
  const { error } = await db.from("api_client").insert({ name: name.trim(), scopes: scopes.value, key_hash: hashApiKey(key) });
  if (error) {
    throw new Error(`Could not create the API client: ${error.message}`);
  }
  console.log(`API client "${name.trim()}" created with scopes ${scopes.value.join(", ")}.`);
  console.log("Key (shown only now; store it in the agent's secret store):");
  console.log(key);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
