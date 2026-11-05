import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createCaseRepository } from "./case-repository";
import { createCaseService, type CaseService } from "./case-service";

export type { CaseHeaderField } from "./case-header-input";
export type { CaseDetail, CaseListItem, ClientTile, Tag } from "./case-repository";
export { CASE_STATUS_LABELS, CASE_STATUSES, type CaseStatus } from "./case-status";
export { type CaseTab, type CaseWarning, warningsForTab } from "./case-warnings";

/** Case service bound to the current request's session (row-level security applies). */
export async function getCaseService(): Promise<CaseService> {
  return createCaseService(createCaseRepository(await createClient()));
}
