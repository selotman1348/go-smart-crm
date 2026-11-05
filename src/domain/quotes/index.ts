import "server-only";

import { createAssessmentRepository } from "@/domain/assessment/assessment-repository";
import { createCaseRepository } from "@/domain/cases/case-repository";
import { createClient } from "@/lib/supabase/server";

import { createQuoteRepository } from "./quote-repository";
import { createQuoteService, type QuoteService } from "./quote-service";

export type { CaseQuotes } from "./quote-repository";
export type { Quote, QuoteLine } from "./quote-rules";

export async function getQuoteService(): Promise<QuoteService> {
  const db = await createClient();
  const cases = createCaseRepository(db);
  const assessments = createAssessmentRepository(db);
  return createQuoteService({
    quotes: createQuoteRepository(db),
    caseStatus: (caseId) => cases.getStatus(caseId),
    assessment: (caseId) => assessments.getForCase(caseId),
  });
}
