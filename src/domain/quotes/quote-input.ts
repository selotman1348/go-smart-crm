import { z } from "zod";

import { optionalText, optionalUuid } from "@/domain/shared/input";
import { moneyField, parseMoney, roundMoney } from "@/domain/shared/money";

import {
  QUOTE_LINE_CATEGORIES,
  QUOTE_LINE_SUB_TYPES,
  quoteTotals,
  SUB_TYPES_BY_CATEGORY,
  USER_QUOTE_ORIGINS,
} from "./quote-lines";

const emptyToNull = (value: unknown) => (typeof value === "string" ? value.trim() || null : (value ?? null));
const AMOUNT_ERROR = "Enter an amount, for example 1234,56.";

const quoteLineSchema = z
  .object({
    id: optionalUuid,
    category: z.enum(QUOTE_LINE_CATEGORIES, { error: "Choose a category." }),
    subType: z.preprocess(emptyToNull, z.enum(QUOTE_LINE_SUB_TYPES, { error: "Choose a valid sub-type." }).nullable()),
    description: optionalText(500),
    amount: z.preprocess(
      parseMoney,
      z.number({ error: AMOUNT_ERROR }).refine((amount) => !Number.isNaN(amount), { error: AMOUNT_ERROR }),
    ),
  })
  .superRefine((line, ctx) => {
    const allowed = SUB_TYPES_BY_CATEGORY[line.category];
    if (allowed.length > 0 && !line.subType) {
      ctx.addIssue({ code: "custom", path: ["subType"], message: "Choose a sub-type." });
    }
    if (line.subType && !allowed.includes(line.subType)) {
      ctx.addIssue({ code: "custom", path: ["subType"], message: "This sub-type does not belong to the category." });
    }
    if (line.category !== "deduction" && line.amount < 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter a positive amount; use a deduction line to subtract." });
    }
    if (Math.abs(line.amount) > 10_000_000) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "The amount is too large." });
    }
  })
  // design.md 1.8: deductions are negative. Typing 150 on a deduction line stores −150.
  .transform((line) => ({
    ...line,
    amount: roundMoney(line.category === "deduction" ? -Math.abs(line.amount) : line.amount),
  }));

const quoteInputSchema = z.object({
  origin: z.enum(USER_QUOTE_ORIGINS, { error: "Choose where the figures come from." }),
  hourlyRatePaint: moneyField({ required: false, max: 1000 }),
  hourlyRateAssembly: moneyField({ required: false, max: 1000 }),
  lines: z.array(quoteLineSchema).max(200, { error: "A quote has at most 200 lines." }),
});

export type QuoteLineInput = z.output<typeof quoteLineSchema>;
export type QuoteInput = z.output<typeof quoteInputSchema> & { total: number };

/** Errors keyed by field path, e.g. "lines.2.amount" or "hourlyRatePaint". */
export type QuoteErrors = Record<string, string[]>;

export function errorsByPath(error: z.ZodError): QuoteErrors {
  const errors: QuoteErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

/** UC-18: validates a pre- or post-calculation and adds its total. */
export function parseQuoteInput(input: unknown): { ok: true; value: QuoteInput } | { ok: false; errors: QuoteErrors } {
  const result = quoteInputSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, errors: errorsByPath(result.error) };
  }
  return { ok: true, value: { ...result.data, total: quoteTotals(result.data.lines).total } };
}
