import { z } from "zod";

import type { AccountType } from "@/domain/accounts/account-types";
import { ACCOUNT_TYPE_LABELS } from "@/domain/accounts/account-types";
import { fieldErrorsOf, optionalUuid, type FieldErrors } from "@/domain/shared/input";

import { PARTY_ROLE_ORDER, PARTY_ROLES, type PartyRole } from "./party-roles";

const partyInputSchema = z
  .object({
    role: z.enum(PARTY_ROLE_ORDER as [PartyRole, ...PartyRole[]], { error: "Choose a role." }),
    accountId: optionalUuid,
    contactId: optionalUuid,
  })
  .superRefine((party, ctx) => {
    const role = PARTY_ROLES[party.role];
    if (role.kind === "person" && !party.contactId) {
      ctx.addIssue({ code: "custom", path: ["contactId"], message: `Choose the ${role.label.toLowerCase()}.` });
    }
    if (role.kind === "organisation" && !party.accountId) {
      ctx.addIssue({ code: "custom", path: ["accountId"], message: "Choose an account." });
    }
  })
  // A person is recorded as a contact only (design.md 1.6).
  .transform((party) =>
    PARTY_ROLES[party.role].kind === "person" ? { ...party, accountId: null } : party,
  );

export type PartyInput = z.output<typeof partyInputSchema>;
export type PartyField = keyof PartyInput;

export type ParsedPartyInput =
  | { ok: true; value: PartyInput }
  | { ok: false; fieldErrors: FieldErrors<PartyField> };

export function parsePartyInput(input: unknown): ParsedPartyInput {
  const result = partyInputSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, fieldErrors: fieldErrorsOf<PartyField>(result.error) };
}

/**
 * Checks the chosen records against the role (UC-11): an organisation must
 * have a matching account type, and a contact must work for the chosen account.
 */
export function checkPartyRecords(
  party: PartyInput,
  records: { accountTypes: AccountType[] | null; contactAccountId: string | null },
): FieldErrors<PartyField> | null {
  const role = PARTY_ROLES[party.role];
  if (party.accountId) {
    if (!records.accountTypes) {
      return { accountId: ["Choose an existing account."] };
    }
    if (!role.accountTypes.some((type) => records.accountTypes!.includes(type))) {
      const expected = role.accountTypes.map((type) => ACCOUNT_TYPE_LABELS[type]).join(" or ");
      return { accountId: [`For the role ${role.label}, choose an account of type ${expected}.`] };
    }
  }
  if (party.contactId) {
    if (!records.contactAccountId) {
      return { contactId: ["Choose an existing contact."] };
    }
    if (party.accountId && records.contactAccountId !== party.accountId) {
      return { contactId: ["This contact does not work for the chosen account."] };
    }
  }
  return null;
}
