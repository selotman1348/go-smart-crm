import "server-only";

import { createCaseRepository } from "@/domain/cases/case-repository";
import { createClient } from "@/lib/supabase/server";

import { createAssessmentRepository } from "./assessment-repository";
import { createAssessmentService, type AssessmentService } from "./assessment-service";

export type { Assessment, ExpertContext } from "./assessment-repository";

export async function getAssessmentService(): Promise<AssessmentService> {
  const db = await createClient();
  const cases = createCaseRepository(db);
  return createAssessmentService(createAssessmentRepository(db), (caseId) => cases.getStatus(caseId));
}
