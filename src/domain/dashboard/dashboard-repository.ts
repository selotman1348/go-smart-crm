import type { DbClient } from "@/lib/supabase/server";

export type HookCounts = {
  intakeDrafts: number;
  outboundDrafts: number;
  undeliveredEvents: number;
  activeApiClients: number;
  completenessRules: number;
};

export function createDashboardRepository(db: DbClient) {
  return {
    /** Creation times of the cases created since the given instant. */
    async caseCreationDates(since: Date): Promise<string[]> {
      const { data, error } = await db.from("case").select("created_at").gte("created_at", since.toISOString());
      if (error) {
        throw new Error(`Could not load cases: ${error.message}`);
      }
      return data.map((row) => row.created_at);
    },

    /** What the phase-2 hook tables hold (plan.md section 3). */
    async hookCounts(): Promise<HookCounts> {
      const { data, error } = await db.rpc("phase2_hook_counts").maybeSingle();
      if (error) {
        throw new Error(`Could not count the phase-2 hooks: ${error.message}`);
      }
      return {
        intakeDrafts: Number(data?.intake_drafts ?? 0),
        outboundDrafts: Number(data?.outbound_drafts ?? 0),
        undeliveredEvents: Number(data?.undelivered_events ?? 0),
        activeApiClients: Number(data?.active_api_clients ?? 0),
        completenessRules: Number(data?.completeness_rules ?? 0),
      };
    },
  };
}
