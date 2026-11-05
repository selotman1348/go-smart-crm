/**
 * Creates the fictitious internal users for development, tests and the demo.
 * Safe to run repeatedly: existing users are left unchanged.
 *
 *   npm run db:seed
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and SEED_USER_PASSWORD
 * from .env.local (or the environment).
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

// Fictitious people on a reserved domain (RFC 2606); no real addresses.
const SEED_USERS = [
  { email: "alex.morgan@gosmart.example", fullName: "Alex Morgan" },
  { email: "sam.taylor@gosmart.example", fullName: "Sam Taylor" },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  }
  return value;
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const password = requireEnv("SEED_USER_PASSWORD");

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw new Error(`Could not list users: ${error.message}`);
  }
  const existing = new Set(data.users.map((user) => user.email?.toLowerCase()));

  for (const user of SEED_USERS) {
    if (existing.has(user.email)) {
      console.log(`exists   ${user.email}`);
      continue;
    }
    const { error: createError } = await supabase.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });
    if (createError) {
      throw new Error(`Could not create ${user.email}: ${createError.message}`);
    }
    console.log(`created  ${user.email}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
