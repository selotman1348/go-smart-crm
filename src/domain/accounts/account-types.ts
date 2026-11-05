import type { Database } from "@/lib/supabase/database.types";

export type AccountType = Database["public"]["Enums"]["account_type"];

/** design.md 1.2, in display order. */
export const ACCOUNT_TYPES = [
  "client",
  "broker",
  "insurer",
  "expert",
  "repairer",
  "leasing_company",
  "supplier",
  "third_party",
] as const satisfies readonly AccountType[];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  client: "Client",
  broker: "Broker",
  insurer: "Insurer",
  expert: "Expert",
  repairer: "Repairer",
  leasing_company: "Leasing company",
  supplier: "Supplier",
  third_party: "Third party",
};

export function isAccountType(value: unknown): value is AccountType {
  return (ACCOUNT_TYPES as readonly unknown[]).includes(value);
}
