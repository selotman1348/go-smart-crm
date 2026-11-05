import type { DbClient } from "@/lib/supabase/server";

/** Lookup tables (design.md 1.12). */
export type LookupName = "on_hold_reason" | "no_repair_reason" | "liability" | "circumstances" | "part_catalog";

export type LookupOption = { code: string; label: string };

export function createLookupRepository(db: DbClient) {
  return {
    /** Active values in display order. */
    async list(name: LookupName): Promise<LookupOption[]> {
      const { data, error } = await db
        .from(name)
        .select("code, label")
        .eq("active", true)
        .order("sort_order");
      if (error) {
        throw new Error(`Could not load ${name}: ${error.message}`);
      }
      return data;
    },
  };
}
