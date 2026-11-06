import "server-only";

import { createInvoiceRepository } from "@/domain/invoicing/invoice-repository";
import { createInvoiceService } from "@/domain/invoicing/invoice-service";
import { createClient } from "@/lib/supabase/server";

import { createCaseRepository } from "./case-repository";
import { createCaseService, type CaseService } from "./case-service";

export type { CaseHeaderField } from "./case-header-input";
export type { CaseDetail, CaseListItem, ClientTile, Tag } from "./case-repository";
export { CASE_STATUS_LABELS, CASE_STATUSES, type CaseStatus } from "./case-status";
export { type CaseTab, type CaseWarning, warningsForTab } from "./case-warnings";

/** Case service bound to the current request's session (row-level security applies). */
export async function getCaseService(): Promise<CaseService> {
  const db = await createClient();
  const invoices = createInvoiceService(createInvoiceRepository(db));
  return createCaseService(createCaseRepository(db), undefined, (caseId) => invoices.completeness(caseId, "invoicing"));
}
