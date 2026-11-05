import { z } from "zod";

/** Amounts are calculated in whole cents so 0.1 + 0.2 never becomes 0.30000000000000004. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Rounds an amount to cents. */
export function roundMoney(amount: number): number {
  return fromCents(toCents(amount));
}

/** "1.234.567" or "1,234": digits in groups of three after the first group. */
function isGrouped(text: string, separator: "." | ","): boolean {
  const escaped = separator === "." ? "\\." : ",";
  return new RegExp(`^\\d{1,3}(${escaped}\\d{3})+$`).test(text);
}

/**
 * Reads an amount typed in Belgian or English style: "1234,56", "1.234,56",
 * "18.500", "1234.56", "1,234.56" or "€ 1 234,56".
 * - With both separators, the last one is the decimal separator.
 * - With one kind, groups of exactly three digits are thousands ("18.500" is
 *   18500, because money has at most two decimals); otherwise it is the
 *   decimal separator ("12,5").
 * Returns null for an empty value and NaN for anything that is not an amount.
 */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  if (typeof value !== "string") {
    return Number.NaN;
  }
  let text = value.replace(/[€\s ]/g, "");
  if (text === "") {
    return null;
  }
  const negative = text.startsWith("-");
  text = text.replace(/^[-+]/, "");

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  let whole = text;
  let fraction = "";
  if (hasComma && hasDot) {
    const decimal = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    [whole, fraction] = [text.slice(0, text.lastIndexOf(decimal)), text.slice(text.lastIndexOf(decimal) + 1)];
    if (!isGrouped(whole, thousands) && !/^\d+$/.test(whole)) {
      return Number.NaN;
    }
    whole = whole.split(thousands).join("");
  } else if (hasComma || hasDot) {
    const separator = hasComma ? "," : ".";
    if (isGrouped(text, separator)) {
      whole = text.split(separator).join("");
    } else {
      const parts = text.split(separator);
      if (parts.length !== 2) {
        return Number.NaN;
      }
      [whole, fraction] = parts;
    }
  }
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) {
    return Number.NaN;
  }
  const amount = Number(`${whole}.${fraction || "0"}`);
  return negative ? -amount : amount;
}

/** "€1,234.56" (en-GB style); negative amounts as "−€150.00". */
export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "";
  }
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(amount);
}

/** A zod field for an amount in euros, from 0 up to `max`. */
export function moneyField(options: { required: boolean; max?: number; message?: string }) {
  const max = options.max ?? 10_000_000;
  const invalid = "Enter an amount, for example 1234,56.";
  const schema = z.preprocess(
    (value) => {
      const amount = parseMoney(value);
      return amount === null ? null : amount;
    },
    z
      .number({ error: invalid })
      .refine((amount) => !Number.isNaN(amount), { error: invalid })
      .refine((amount) => amount >= 0 && amount <= max, { error: `Enter an amount from 0 to ${max}.` })
      .transform(roundMoney)
      .nullable(),
  );
  return options.required
    ? schema.refine((amount) => amount !== null, { error: options.message ?? "Enter an amount." })
    : schema;
}
