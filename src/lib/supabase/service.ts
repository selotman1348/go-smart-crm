import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/env";

import type { Database } from "./database.types";
import type { DbClient } from "./server";

/**
 * Service-role client for callers without a user session: the inbound
 * e-mail webhook, the external API and the event dispatcher. It bypasses
 * row-level security, so only src/domain/intake, src/domain/api and
 * src/domain/events use it, after checking the caller's secret or API key.
 */
export function createServiceClient(): DbClient {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY in the environment (see .env.example).");
  }
  return createClient<Database>(getSupabaseEnv().url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
