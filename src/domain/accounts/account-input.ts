import { z } from "zod";

import {
  checkbox,
  fieldErrorsOf,
  optionalEmail,
  optionalNumber,
  optionalText,
  optionalUuid,
  requiredText,
  stringList,
  type FieldErrors,
} from "@/domain/shared/input";

import { ACCOUNT_TYPES } from "./account-types";

export const CLIENT_CODE_PATTERN = /^[A-Z]{3,4}$/;

const accountInputSchema = z
  .object({
    name: requiredText("Enter the account name."),
    accountTypes: z.preprocess(
      stringList,
      z
        .array(z.enum(ACCOUNT_TYPES, { error: "Choose a valid account type." }))
        .min(1, { error: "Choose at least one account type." }),
    ),
    clientCode: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toUpperCase() || null : value ?? null),
      z
        .string()
        .regex(CLIENT_CODE_PATTERN, { error: "Use 3 or 4 capital letters, for example ABC." })
        .nullable(),
    ),
    parentAccountId: optionalUuid,
    vatNumber: optionalText(30),
    vatLiable: checkbox,
    addressLine1: optionalText(),
    addressLine2: optionalText(),
    postcode: optionalText(20),
    city: optionalText(100),
    country: optionalText(100),
    phone: optionalText(40),
    email: optionalEmail,
    invoicingConditions: optionalText(4000),
    discountPct: optionalNumber({ min: 0, max: 100 }),
    requiresVdaPo: checkbox,
    isNetworkMember: checkbox,
  })
  .superRefine((account, ctx) => {
    const isClient = account.accountTypes.includes("client");
    // BR-01: the client code is the case-number prefix.
    if (isClient && !account.clientCode) {
      ctx.addIssue({
        code: "custom",
        path: ["clientCode"],
        message: "A client needs a client code; it starts every case number.",
      });
    }
    if (!isClient && account.clientCode) {
      ctx.addIssue({
        code: "custom",
        path: ["clientCode"],
        message: "Only clients have a client code.",
      });
    }
  })
  // Settings that only apply to one account type are cleared for the others.
  .transform((account) => {
    const isClient = account.accountTypes.includes("client");
    const isRepairer = account.accountTypes.includes("repairer");
    return {
      ...account,
      accountTypes: [...new Set(account.accountTypes)],
      requiresVdaPo: isClient && account.requiresVdaPo,
      invoicingConditions: isRepairer ? account.invoicingConditions : null,
      discountPct: isRepairer ? account.discountPct : null,
      isNetworkMember: isRepairer && account.isNetworkMember,
    };
  });

export type AccountInput = z.output<typeof accountInputSchema>;
export type AccountField = keyof AccountInput;

export type ParsedAccountInput =
  | { ok: true; value: AccountInput }
  | { ok: false; fieldErrors: FieldErrors<AccountField> };

/** Validates account form input. Pass `accountId` when editing an existing account. */
export function parseAccountInput(
  input: unknown,
  options: { accountId?: string } = {},
): ParsedAccountInput {
  const result = accountInputSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, fieldErrors: fieldErrorsOf<AccountField>(result.error) };
  }
  if (options.accountId && result.data.parentAccountId === options.accountId) {
    return {
      ok: false,
      fieldErrors: { parentAccountId: ["An account cannot be its own parent."] },
    };
  }
  return { ok: true, value: result.data };
}
