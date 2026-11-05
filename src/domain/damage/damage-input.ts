import { z } from "zod";

import {
  fieldErrorsOf,
  optionalCode,
  optionalDate,
  optionalInteger,
  optionalText,
  stringList,
  type FieldErrors,
} from "@/domain/shared/input";

/** UC-12: damage details and the damaged-parts checklist. */
const damageInputSchema = z
  .object({
    damageDate: optionalDate,
    mileageIn: optionalInteger({ min: 0, max: 2_000_000 }),
    mileageOut: optionalInteger({ min: 0, max: 2_000_000 }),
    addressLine1: optionalText(),
    addressLine2: optionalText(),
    postcode: optionalText(20),
    city: optionalText(100),
    country: optionalText(100),
    cause: optionalText(1000),
    liability: optionalCode,
    circumstances: optionalCode,
    extraInfo: optionalText(2000),
    parts: z.preprocess(
      stringList,
      z.array(z.string().regex(/^[a-z][a-z0-9_]*$/, { error: "Choose valid parts." })),
    ),
  })
  .superRefine((damage, ctx) => {
    if (damage.mileageIn !== null && damage.mileageOut !== null && damage.mileageOut < damage.mileageIn) {
      ctx.addIssue({
        code: "custom",
        path: ["mileageOut"],
        message: "Mileage out cannot be lower than mileage in.",
      });
    }
  })
  .transform((damage) => ({ ...damage, parts: [...new Set(damage.parts)] }));

export type DamageInput = z.output<typeof damageInputSchema>;
export type DamageField = keyof DamageInput;

export type ParsedDamageInput =
  | { ok: true; value: DamageInput }
  | { ok: false; fieldErrors: FieldErrors<DamageField> };

export function parseDamageInput(input: unknown): ParsedDamageInput {
  const result = damageInputSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, fieldErrors: fieldErrorsOf<DamageField>(result.error) };
}
