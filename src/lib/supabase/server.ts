import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getSupabaseEnv } from "@/lib/env";

import type { Database } from "./database.types";

export type DbClient = SupabaseClient<Database>;

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Only `src/domain/` may use it (enforced by ESLint).
 */
export async function createClient(): Promise<DbClient> {
  // Session checks compare token expiry with the current time, so they must
  // run for a real request, never in a (runtime) prerender or prefetch.
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
