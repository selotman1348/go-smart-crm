import type { Database } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/server";

import type { CaseStatus } from "@/domain/cases/case-status";
import type { RepositoryError } from "@/domain/shared/repository";

import type { NoRepairValues, TotalLossValues } from "./repair-decision";

type AssessmentRow = Database["public"]["Tables"]["assessment"]["Row"];

export type Assessment = {
  id: string;
  assessmentType: AssessmentRow["assessment_type"];
  expertAccountId: string | null;
  expertReportDocumentId: string | null;
  vatApplicable: boolean | null;
  approvedAmountExclVat: number | null;
  approvedAmountInclVat: number | null;
  lossOfUseDays: number | null;
  totalLossVehicleValue: number | null;
  totalLossPreviousDamageDeduction: number | null;
  totalLossAccessories: number | null;
  totalLossWreckValue: number | null;
  totalLossDamageAmount: number | null;
  validatedAt: string | null;
  validatedBy: string | null;
};

export function toAssessment(row: AssessmentRow & { validator?: { full_name: string } | null }): Assessment {
  return {
    id: row.id,
    assessmentType: row.assessment_type,
    expertAccountId: row.expert_account_id,
    expertReportDocumentId: row.expert_report_document_id,
    vatApplicable: row.vat_applicable,
    approvedAmountExclVat: row.approved_amount_excl_vat,
    approvedAmountInclVat: row.approved_amount_incl_vat,
    lossOfUseDays: row.loss_of_use_days,
    totalLossVehicleValue: row.total_loss_vehicle_value,
    totalLossPreviousDamageDeduction: row.total_loss_previous_damage_deduction,
    totalLossAccessories: row.total_loss_accessories,
    totalLossWreckValue: row.total_loss_wreck_value,
    totalLossDamageAmount: row.total_loss_damage_amount,
    validatedAt: row.validated_at,
    validatedBy: row.validator?.full_name ?? null,
  };
}

export type ExpertContext = {
  /** Expert accounts that are parties on the case (UC-23). */
  experts: { id: string; name: string }[];
  /** The case's documents in the category "Expert report" (UC-24). */
  expertReports: { id: string; fileName: string }[];
};

export function createAssessmentRepository(db: DbClient) {
  return {
    async getForCase(caseId: string): Promise<Assessment | null> {
      const { data, error } = await db
        .from("assessment")
        .select("*, validator:app_user!assessment_validated_by_fkey (full_name)")
        .eq("case_id", caseId)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the assessment: ${error.message}`);
      }
      return data ? toAssessment(data) : null;
    },

    async expertContext(caseId: string): Promise<ExpertContext> {
      const [parties, reports] = await Promise.all([
        db
          .from("case_party")
          .select("account:account_id (id, name)")
          .eq("case_id", caseId)
          .eq("role", "expert")
          .not("account_id", "is", null),
        db
          .from("document")
          .select("id, file_name")
          .eq("case_id", caseId)
          .eq("category", "expert_report")
          .order("created_at", { ascending: false }),
      ]);
      if (parties.error || reports.error) {
        throw new Error(`Could not load the expert details: ${(parties.error ?? reports.error)!.message}`);
      }
      const experts = new Map<string, string>();
      for (const party of parties.data) {
        if (party.account) {
          experts.set(party.account.id, party.account.name);
        }
      }
      return {
        experts: [...experts].map(([id, name]) => ({ id, name })),
        expertReports: reports.data.map((row) => ({ id: row.id, fileName: row.file_name })),
      };
    },

    /** UC-24: the expert and the stored expert report. */
    async saveExpert(
      caseId: string,
      values: { expertAccountId: string | null; expertReportDocumentId: string | null },
    ): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.from("assessment").upsert(
        {
          case_id: caseId,
          expert_account_id: values.expertAccountId,
          expert_report_document_id: values.expertReportDocumentId,
        },
        { onConflict: "case_id", defaultToNull: false },
      );
      return error ? { ok: false, error } : { ok: true };
    },

    /** Records no repair or total loss and closes the case (record_repair_decision). */
    async recordDecision(
      caseId: string,
      decision:
        | { kind: "no_repair"; values: NoRepairValues }
        | { kind: "total_loss"; values: TotalLossValues },
      expectedStatus: CaseStatus,
    ): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const totalLoss = decision.kind === "total_loss" ? decision.values : null;
      const noRepair = decision.kind === "no_repair" ? decision.values : null;
      const { error } = await db.rpc("record_repair_decision", {
        p_case_id: caseId,
        p_decision: decision.kind,
        p_no_repair_reason: sqlNull(noRepair?.reason),
        p_no_repair_reason_text: sqlNull(noRepair?.reasonText),
        p_total_loss_vehicle_value: sqlNull(totalLoss?.vehicleValue),
        p_total_loss_previous_damage_deduction: sqlNull(totalLoss?.previousDamageDeduction),
        p_total_loss_accessories: sqlNull(totalLoss?.accessories),
        p_total_loss_wreck_value: sqlNull(totalLoss?.wreckValue),
        p_total_loss_damage_amount: sqlNull(totalLoss?.damageAmount),
        p_expected_status: expectedStatus,
      });
      return error ? { ok: false, error } : { ok: true };
    },
  };
}

/**
 * An RPC argument without a value. PostgREST matches functions by the names
 * of the arguments sent, and undefined ones are dropped, so send null.
 */
function sqlNull<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}

export type AssessmentRepository = ReturnType<typeof createAssessmentRepository>;
