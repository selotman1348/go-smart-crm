import { isUuid, type SaveResult } from "@/domain/shared/input";
import type { RepositoryError } from "@/domain/shared/repository";

import { parseDamageInput, type DamageField } from "./damage-input";
import type { DamageRepository } from "./damage-repository";

export const DAMAGE_SAVE_FAILED_MESSAGE = "The damage could not be saved. Please try again.";

function explainWriteError(error: RepositoryError | "not_found"): SaveResult<DamageField> {
  // 23503: an unknown lookup code or case.
  if (error !== "not_found" && error.code === "23503") {
    if (error.message.includes("liability")) {
      return { ok: false, fieldErrors: { liability: ["Choose a valid option."] } };
    }
    if (error.message.includes("circumstances")) {
      return { ok: false, fieldErrors: { circumstances: ["Choose a valid option."] } };
    }
    if (error.message.includes("part_code")) {
      return { ok: false, fieldErrors: { parts: ["Choose valid parts."] } };
    }
    return { ok: false, formError: "This case no longer exists." };
  }
  return { ok: false, formError: DAMAGE_SAVE_FAILED_MESSAGE };
}

export function createDamageService(repository: DamageRepository) {
  return {
    getForCase(caseId: string) {
      return isUuid(caseId) ? repository.getForCase(caseId) : Promise.resolve(null);
    },

    /** UC-12: saves the damage details and the damaged-parts checklist. */
    async save(caseId: string, input: unknown): Promise<SaveResult<DamageField>> {
      if (!isUuid(caseId)) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const parsed = parseDamageInput(input);
      if (!parsed.ok) {
        return { ok: false, fieldErrors: parsed.fieldErrors };
      }
      const { parts, ...damage } = parsed.value;
      const current = await repository.getForCase(caseId);
      const saved = await repository.save(caseId, damage);
      if (!saved.ok) {
        return explainWriteError(saved.error);
      }
      const partsSaved = await repository.setParts(saved.id, current?.parts ?? [], parts);
      return partsSaved.ok ? saved : explainWriteError(partsSaved.error);
    },
  };
}

export type DamageService = ReturnType<typeof createDamageService>;
