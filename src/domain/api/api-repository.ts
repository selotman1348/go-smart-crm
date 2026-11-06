import type { Json } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/server";

import type { CaseStatus } from "@/domain/cases/case-status";
import type { RepositoryError } from "@/domain/shared/repository";

import type { ApiClient } from "./api-keys";

export type ApiCaseSummary = {
  caseNumber: string;
  status: CaseStatus;
  client: string | null;
  licencePlate: string | null;
  createdAt: string;
};

export type ApiCase = ApiCaseSummary & {
  id: string;
  insurerRef: string | null;
  brokerRef: string | null;
  policyNumber: string | null;
  parties: { role: string; account: string | null; contact: string | null }[];
};

const SUMMARY_COLUMNS =
  "id, case_number, status, created_at, client:account!case_client_account_id_fkey (name), vehicle:vehicle!case_vehicle_id_fkey (licence_plate)";

/** Data access for the external API; works with the service role after the key check. */
export function createApiRepository(db: DbClient) {
  return {
    async clientByKeyHash(keyHash: string): Promise<ApiClient | null> {
      const { data, error } = await db
        .from("api_client")
        .select("id, name, scopes")
        .eq("key_hash", keyHash)
        .eq("active", true)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not check the API key: ${error.message}`);
      }
      return data;
    },

    async listCases(filter: { status: CaseStatus | null; limit: number }): Promise<ApiCaseSummary[]> {
      let request = db.from("case").select(SUMMARY_COLUMNS).order("created_at", { ascending: false }).limit(filter.limit);
      if (filter.status) {
        request = request.eq("status", filter.status);
      }
      const { data, error } = await request;
      if (error) {
        throw new Error(`Could not load cases: ${error.message}`);
      }
      return data.map((row) => ({
        caseNumber: row.case_number,
        status: row.status,
        client: row.client?.name ?? null,
        licencePlate: row.vehicle?.licence_plate ?? null,
        createdAt: row.created_at,
      }));
    },

    async caseByNumber(caseNumber: string): Promise<ApiCase | null> {
      const { data, error } = await db
        .from("case")
        .select(
          `${SUMMARY_COLUMNS}, insurer_ref, broker_ref, policy_number,
           case_party (role, account:account!case_party_account_id_fkey (name), contact (first_name, last_name))`,
        )
        .eq("case_number", caseNumber)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the case: ${error.message}`);
      }
      if (!data) {
        return null;
      }
      return {
        id: data.id,
        caseNumber: data.case_number,
        status: data.status,
        client: data.client?.name ?? null,
        licencePlate: data.vehicle?.licence_plate ?? null,
        createdAt: data.created_at,
        insurerRef: data.insurer_ref,
        brokerRef: data.broker_ref,
        policyNumber: data.policy_number,
        parties: data.case_party.map((party) => ({
          role: party.role,
          account: party.account?.name ?? null,
          contact: party.contact ? [party.contact.first_name, party.contact.last_name].filter(Boolean).join(" ") : null,
        })),
      };
    },

    async templateId(code: string, language: string): Promise<string | null> {
      const { data } = await db.from("email_template").select("id").eq("code", code).eq("language", language).maybeSingle();
      return data?.id ?? null;
    },

    async createOutboundDraft(
      clientId: string,
      draft: { caseId: string; templateId: string | null; to: string[]; cc: string[]; subject: string; body: string },
    ): Promise<{ ok: true; id: string } | { ok: false; error: RepositoryError }> {
      const { data, error } = await db.rpc("agent_create_outbound_draft", {
        p_api_client_id: clientId,
        p_case_id: draft.caseId,
        p_template_id: draft.templateId as string,
        p_to: draft.to,
        p_cc: draft.cc,
        p_subject: draft.subject,
        p_body: draft.body,
        p_merge_data: {},
      });
      return error ? { ok: false, error } : { ok: true, id: data };
    },

    async proposeIntake(
      clientId: string,
      emailId: string,
      proposal: { proposedFields: Json; fieldConfidence: Json; missingFields: string[] },
    ): Promise<{ ok: true; id: string } | { ok: false; error: RepositoryError }> {
      const { data, error } = await db.rpc("agent_propose_intake", {
        p_api_client_id: clientId,
        p_email_id: emailId,
        p_proposed_fields: proposal.proposedFields,
        p_field_confidence: proposal.fieldConfidence,
        p_missing_fields: proposal.missingFields,
      });
      return error ? { ok: false, error } : { ok: true, id: data };
    },
  };
}

export type ApiRepository = ReturnType<typeof createApiRepository>;
