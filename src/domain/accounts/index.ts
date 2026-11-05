import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createAccountRepository } from "./account-repository";
import { createAccountService, type AccountService } from "./account-service";

export type { AccountField } from "./account-input";
export type { Account, AccountListItem, AccountOption, TypedAccountOption } from "./account-repository";
export { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, isAccountType, type AccountType } from "./account-types";

/** Account service bound to the current request's session (row-level security applies). */
export async function getAccountService(): Promise<AccountService> {
  return createAccountService(createAccountRepository(await createClient()));
}
