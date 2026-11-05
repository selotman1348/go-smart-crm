import type { Database } from "@/lib/supabase/database.types";

import { fromCents, toCents } from "@/domain/shared/money";

type Enums = Database["public"]["Enums"];
export type QuoteLineCategory = Enums["quote_line_category"];
export type QuoteLineSubType = Enums["quote_line_sub_type"];
export type QuoteVersion = Enums["quote_version"];
export type QuoteStatus = Enums["quote_status"];
export type QuoteOrigin = Enums["quote_origin"];

/** design.md 1.8, in the order of the use case. */
export const QUOTE_LINE_CATEGORIES = [
  "labour",
  "parts",
  "paint_products",
  "smart_repair",
  "other_costs",
  "fixed_price",
  "deduction",
] as const satisfies readonly QuoteLineCategory[];

export const CATEGORY_LABELS: Record<QuoteLineCategory, string> = {
  labour: "Labour",
  parts: "Parts",
  paint_products: "Paint products",
  smart_repair: "Smart repair",
  other_costs: "Other costs",
  fixed_price: "Fixed price",
  deduction: "Deduction",
};

/**
 * Sub-types per category (design.md 1.8). Categories with sub-types require
 * one (Q-010, agreed 2026-11-05); the others have none.
 */
export const SUB_TYPES_BY_CATEGORY: Record<QuoteLineCategory, readonly QuoteLineSubType[]> = {
  labour: ["assembly_disassembly", "paintwork", "panel_work", "preparation", "finishing"],
  parts: [],
  paint_products: [],
  smart_repair: [],
  other_costs: [
    "environmental_fee",
    "anti_rust",
    "small_parts",
    "polishing",
    "covid_flat_fee",
    "cavity_protection",
    "diagnostics",
    "miscellaneous",
  ],
  fixed_price: [],
  deduction: ["previous_claim", "wear_and_tear"],
};

export const QUOTE_LINE_SUB_TYPES = Object.values(SUB_TYPES_BY_CATEGORY).flat() as QuoteLineSubType[];

export const SUB_TYPE_LABELS: Record<QuoteLineSubType, string> = {
  assembly_disassembly: "Assembly / disassembly",
  paintwork: "Paintwork",
  panel_work: "Panel work",
  preparation: "Preparation",
  finishing: "Finishing",
  environmental_fee: "Environmental fee",
  anti_rust: "Anti-rust",
  small_parts: "Small parts",
  polishing: "Polishing",
  covid_flat_fee: "COVID flat fee",
  cavity_protection: "Cavity protection",
  diagnostics: "Diagnostics",
  miscellaneous: "Miscellaneous",
  previous_claim: "Previous claim",
  wear_and_tear: "Wear and tear",
};

export const QUOTE_VERSION_LABELS: Record<QuoteVersion, string> = {
  pre_calculation: "Pre-calculation",
  post_calculation: "Post-calculation",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  validated: "Validated",
  rejected: "Rejected",
  sent: "Sent",
};

export const QUOTE_ORIGIN_LABELS: Record<QuoteOrigin, string> = {
  repairer: "Repairer estimate",
  expert: "Expert report",
  manual: "Entered manually",
  ai: "AI proposal",
};

/** Origins a user can choose; "ai" is reserved for phase 2. */
export const USER_QUOTE_ORIGINS = ["repairer", "expert", "manual"] as const satisfies readonly QuoteOrigin[];

export type QuoteTotals = {
  /** Subtotal per category, only for categories with lines, in category order. */
  subtotals: { category: QuoteLineCategory; amount: number }[];
  total: number;
};

/** UC-18: subtotals per category and the total, calculated in cents. */
export function quoteTotals(lines: { category: QuoteLineCategory; amount: number }[]): QuoteTotals {
  const cents = new Map<QuoteLineCategory, number>();
  for (const line of lines) {
    cents.set(line.category, (cents.get(line.category) ?? 0) + toCents(line.amount));
  }
  const subtotals = QUOTE_LINE_CATEGORIES.filter((category) => cents.has(category)).map((category) => ({
    category,
    amount: fromCents(cents.get(category)!),
  }));
  const total = fromCents([...cents.values()].reduce((sum, value) => sum + value, 0));
  return { subtotals, total };
}
