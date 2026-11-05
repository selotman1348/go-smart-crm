import type { Database } from "@/lib/supabase/database.types";

import type { AccountType } from "@/domain/accounts/account-types";

export type PartyRole = Database["public"]["Enums"]["party_role"];

type RoleDefinition = {
  label: string;
  /** People are recorded as a contact; organisations as an account (design.md 1.6). */
  kind: "person" | "organisation";
  /** Account types an organisation in this role must have. */
  accountTypes: AccountType[];
};

/** UC-11, in the order of the use case. */
export const PARTY_ROLES: Record<PartyRole, RoleDefinition> = {
  // BR-02: the owner/fleet owner is the invoice party.
  owner_fleet_owner: { label: "Owner / fleet owner", kind: "organisation", accountTypes: ["client"] },
  leasing_company: { label: "Leasing company", kind: "organisation", accountTypes: ["leasing_company"] },
  driver: { label: "Driver", kind: "person", accountTypes: [] },
  insured_tenant: { label: "Insured / tenant", kind: "person", accountTypes: [] },
  insurer: { label: "Insurer", kind: "organisation", accountTypes: ["insurer"] },
  intermediary: { label: "Intermediary", kind: "organisation", accountTypes: ["broker"] },
  third_party: { label: "Third party", kind: "organisation", accountTypes: ["third_party"] },
  expert: { label: "Expert", kind: "organisation", accountTypes: ["expert"] },
  repairer: { label: "Repairer", kind: "organisation", accountTypes: ["repairer"] },
};

export const PARTY_ROLE_ORDER = Object.keys(PARTY_ROLES) as PartyRole[];

export function isPartyRole(value: unknown): value is PartyRole {
  return typeof value === "string" && value in PARTY_ROLES;
}
