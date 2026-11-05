import { isUuid, type SaveResult } from "@/domain/shared/input";
import type { RepositoryError } from "@/domain/shared/repository";

import { checkPartyRecords, parsePartyInput, type PartyField } from "./party-input";
import type { PartyRepository } from "./party-repository";

export const PARTY_SAVE_FAILED_MESSAGE = "The party could not be saved. Please try again.";

function explainWriteError(error: RepositoryError | "not_found"): SaveResult<PartyField> {
  if (error !== "not_found" && error.code === "23505") {
    if (error.message.includes("one_owner_fleet_owner")) {
      return {
        ok: false,
        fieldErrors: { role: ["This case already has an owner/fleet owner. Remove it first."] },
      };
    }
    return { ok: false, formError: "This party is already on the case." };
  }
  if (error === "not_found") {
    return { ok: false, formError: "This case no longer exists." };
  }
  return { ok: false, formError: PARTY_SAVE_FAILED_MESSAGE };
}

export function createPartyService(repository: PartyRepository) {
  return {
    listForCase(caseId: string) {
      return isUuid(caseId) ? repository.listForCase(caseId) : Promise.resolve([]);
    },

    contactOptions() {
      return repository.contactOptions();
    },

    /** UC-11: adds an account or contact to the case in a role. */
    async add(caseId: string, input: unknown): Promise<SaveResult<PartyField>> {
      if (!isUuid(caseId)) {
        return { ok: false, formError: "This case no longer exists." };
      }
      const parsed = parsePartyInput(input);
      if (!parsed.ok) {
        return { ok: false, fieldErrors: parsed.fieldErrors };
      }
      const party = parsed.value;
      const recordErrors = checkPartyRecords(party, {
        accountTypes: party.accountId ? await repository.accountTypes(party.accountId) : null,
        contactAccountId: party.contactId ? await repository.contactAccountId(party.contactId) : null,
      });
      if (recordErrors) {
        return { ok: false, fieldErrors: recordErrors };
      }
      const result = await repository.add(caseId, party);
      return result.ok ? result : explainWriteError(result.error);
    },

    async remove(caseId: string, partyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
      if (!isUuid(caseId) || !isUuid(partyId)) {
        return { ok: false, error: "This party no longer exists." };
      }
      const result = await repository.remove(caseId, partyId);
      if (result.ok) {
        return result;
      }
      return {
        ok: false,
        error: result.error === "not_found" ? "This party no longer exists." : PARTY_SAVE_FAILED_MESSAGE,
      };
    },
  };
}

export type PartyService = ReturnType<typeof createPartyService>;
