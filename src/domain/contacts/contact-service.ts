import { isUuid, type SaveResult } from "@/domain/shared/input";
import type { RepositoryError } from "@/domain/shared/repository";

import { parseContactInput, type ContactField } from "./contact-input";
import type { ContactListQuery, ContactRepository } from "./contact-repository";

export const CONTACT_SAVE_FAILED_MESSAGE = "The contact could not be saved. Please try again.";
export const CONTACT_NOT_FOUND_MESSAGE = "This contact no longer exists.";

function explainWriteError(error: RepositoryError | "not_found"): SaveResult<ContactField> {
  if (error === "not_found") {
    return { ok: false, formError: CONTACT_NOT_FOUND_MESSAGE };
  }
  // 23503: foreign_key_violation on account_id.
  if (error.code === "23503") {
    return { ok: false, fieldErrors: { accountId: ["Choose an existing account."] } };
  }
  return { ok: false, formError: CONTACT_SAVE_FAILED_MESSAGE };
}

export function createContactService(repository: ContactRepository) {
  return {
    list(query: ContactListQuery) {
      return repository.list(query);
    },

    listByAccount(accountId: string) {
      return isUuid(accountId) ? repository.listByAccount(accountId) : Promise.resolve([]);
    },

    get(id: string) {
      return isUuid(id) ? repository.getById(id) : Promise.resolve(null);
    },

    /** UC-38: creates a contact, or updates it when `contactId` is given. */
    async save(input: unknown, contactId?: string): Promise<SaveResult<ContactField>> {
      const parsed = parseContactInput(input);
      if (!parsed.ok) {
        return { ok: false, fieldErrors: parsed.fieldErrors };
      }
      const result = contactId
        ? await repository.update(contactId, parsed.value)
        : await repository.create(parsed.value);
      return result.ok ? result : explainWriteError(result.error);
    },
  };
}

export type ContactService = ReturnType<typeof createContactService>;
