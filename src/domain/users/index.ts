import "server-only";

import { createClient } from "@/lib/supabase/server";

export type UserOption = { id: string; fullName: string };

/** Internal users, e.g. for the case manager and assigned-to pickers. */
export async function listUserOptions(): Promise<UserOption[]> {
  const db = await createClient();
  const { data, error } = await db.from("app_user").select("id, full_name").order("full_name");
  if (error) {
    throw new Error(`Could not load users: ${error.message}`);
  }
  return data.map((row) => ({ id: row.id, fullName: row.full_name }));
}
