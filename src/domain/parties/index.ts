import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createPartyRepository } from "./party-repository";
import { createPartyService, type PartyService } from "./party-service";

export type { PartyField } from "./party-input";
export type { CaseParty, ContactOption } from "./party-repository";
export { PARTY_ROLE_ORDER, PARTY_ROLES, type PartyRole } from "./party-roles";

export async function getPartyService(): Promise<PartyService> {
  return createPartyService(createPartyRepository(await createClient()));
}
