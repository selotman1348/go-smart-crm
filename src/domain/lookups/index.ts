import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createLookupRepository } from "./lookup-repository";

export type { LookupName, LookupOption } from "./lookup-repository";

export async function getLookups() {
  return createLookupRepository(await createClient());
}
