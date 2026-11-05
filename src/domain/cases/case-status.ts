import type { Database } from "@/lib/supabase/database.types";

export type CaseStatus = Database["public"]["Enums"]["case_status"];

/** requirements.md section 5, in work-queue order. */
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  client_assignment: "Client assignment",
  intake_first_contact: "Intake – first contact",
  followup_client: "File follow-up – client",
  followup_broker_insurer: "File follow-up – broker/insurer",
  followup_repairer: "File follow-up – repairer",
  followup_expert: "File follow-up – expert",
  followup_repairer_report_ok: "File follow-up – repairer (expert report OK)",
  followup_delay: "File follow-up – delay",
  invoicing_other: "Invoicing – other",
  invoicing_ok: "Invoicing – OK",
  closed: "Closed",
};

export const CASE_STATUSES = Object.keys(CASE_STATUS_LABELS) as CaseStatus[];
