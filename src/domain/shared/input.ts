import { z } from "zod";

// Building blocks for parsing form input (FormData values are strings, null
// for missing fields, and "on" for ticked checkboxes).

function trimToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

export function requiredText(message: string, max = 200) {
  return z.preprocess(
    trimToNull,
    z
      .string({ error: message })
      .max(max, { error: `Use at most ${max} characters.` }),
  );
}

export function optionalText(max = 200) {
  return z.preprocess(
    trimToNull,
    z.string().max(max, { error: `Use at most ${max} characters.` }).nullable(),
  );
}

export const optionalEmail = z.preprocess(
  trimToNull,
  z.email({ error: "Enter a valid e-mail address." }).nullable(),
);

export const optionalUuid = z.preprocess(
  trimToNull,
  z.uuid({ error: "Choose a valid option." }).nullable(),
);

export const checkbox = z.preprocess(
  (value) => value === true || value === "on" || value === "true",
  z.boolean(),
);

/** Accepts "13", "13.5" and "13,5"; empty means no value. */
export function optionalNumber(options: { min: number; max: number }) {
  const message = `Enter a number from ${options.min} to ${options.max}.`;
  return z.preprocess(
    (value) => {
      const text = trimToNull(value);
      return typeof text === "string" ? Number(text.replace(",", ".")) : text;
    },
    z
      .number({ error: message })
      .min(options.min, { error: message })
      .max(options.max, { error: message })
      .nullable(),
  );
}

/** Whole numbers only, e.g. mileage or model year; empty means no value. */
export function optionalInteger(options: { min: number; max: number }) {
  const message = `Enter a whole number from ${options.min} to ${options.max}.`;
  return z.preprocess(
    (value) => {
      const text = trimToNull(value);
      return typeof text === "string" ? Number(text.replace(/[\s.]/g, "")) : text;
    },
    z
      .number({ error: message })
      .int({ error: message })
      .min(options.min, { error: message })
      .max(options.max, { error: message })
      .nullable(),
  );
}

/** A calendar date as YYYY-MM-DD (the value of an <input type="date">). */
export const optionalDate = z.preprocess(
  trimToNull,
  z.iso.date({ error: "Enter a valid date." }).nullable(),
);

/** A lookup or enum code such as "awaiting_parts"; empty means none. */
export const optionalCode = z.preprocess(
  trimToNull,
  z.string().regex(/^[a-z][a-z0-9_]*$/, { error: "Choose a valid option." }).nullable(),
);

export function stringList(value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export type FieldErrors<Field extends string> = Partial<Record<Field, string[]>>;

export function fieldErrorsOf<Field extends string>(error: z.ZodError): FieldErrors<Field> {
  return z.flattenError(error).fieldErrors as FieldErrors<Field>;
}

/** Result of creating or updating a record. */
export type SaveResult<Field extends string> =
  | { ok: true; id: string }
  | { ok: false; fieldErrors?: FieldErrors<Field>; formError?: string };

export const isUuid = (value: unknown): value is string =>
  z.uuid().safeParse(value).success;
