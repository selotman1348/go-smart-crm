import { z } from "zod";

import {
  fieldErrorsOf,
  optionalEmail,
  optionalText,
  requiredText,
  type FieldErrors,
} from "@/domain/shared/input";

const contactInputSchema = z.object({
  // design.md 1.1: every contact belongs to one account (its employer).
  accountId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null),
    z.uuid({ error: "Choose the contact's account." }),
  ),
  salutation: optionalText(30),
  firstName: optionalText(100),
  lastName: requiredText("Enter the last name.", 100),
  email: optionalEmail,
  phone: optionalText(40),
});

export type ContactInput = z.output<typeof contactInputSchema>;
export type ContactField = keyof ContactInput;

export type ParsedContactInput =
  | { ok: true; value: ContactInput }
  | { ok: false; fieldErrors: FieldErrors<ContactField> };

export function parseContactInput(input: unknown): ParsedContactInput {
  const result = contactInputSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, fieldErrors: fieldErrorsOf<ContactField>(result.error) };
}
