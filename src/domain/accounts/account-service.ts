import { isUuid, type SaveResult } from "@/domain/shared/input";
import type { RepositoryError } from "@/domain/shared/repository";

import { parseAccountInput, type AccountField } from "./account-input";
import type { AccountListQuery, AccountRepository } from "./account-repository";

export const ACCOUNT_SAVE_FAILED_MESSAGE = "The account could not be saved. Please try again.";
export const ACCOUNT_NOT_FOUND_MESSAGE = "This account no longer exists.";

function explainWriteError(error: RepositoryError | "not_found"): SaveResult<AccountField> {
  if (error === "not_found") {
    return { ok: false, formError: ACCOUNT_NOT_FOUND_MESSAGE };
  }
  // 23505: unique_violation (the only unique column users enter is client_code).
  if (error.code === "23505" && error.message.includes("client_code")) {
    return {
      ok: false,
      fieldErrors: { clientCode: ["This client code is already used by another account."] },
    };
  }
  // 23503: foreign_key_violation, e.g. the chosen parent account was removed.
  if (error.code === "23503") {
    return { ok: false, fieldErrors: { parentAccountId: ["Choose an existing account."] } };
  }
  return { ok: false, formError: ACCOUNT_SAVE_FAILED_MESSAGE };
}

export function createAccountService(repository: AccountRepository) {
  return {
    list(query: AccountListQuery) {
      return repository.list(query);
    },

    get(id: string) {
      return isUuid(id) ? repository.getById(id) : Promise.resolve(null);
    },

    listOptions() {
      return repository.listOptions();
    },

    /** UC-38: creates an account, or updates it when `accountId` is given. */
    async save(input: unknown, accountId?: string): Promise<SaveResult<AccountField>> {
      const parsed = parseAccountInput(input, { accountId });
      if (!parsed.ok) {
        return { ok: false, fieldErrors: parsed.fieldErrors };
      }
      const result = accountId
        ? await repository.update(accountId, parsed.value)
        : await repository.create(parsed.value);
      return result.ok ? result : explainWriteError(result.error);
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
