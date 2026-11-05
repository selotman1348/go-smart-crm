import type { QuoteLineCategory, QuoteLineSubType, QuoteOrigin, QuoteStatus, QuoteVersion } from "./quote-lines";

export type QuoteLine = {
  id: string;
  category: QuoteLineCategory;
  subType: QuoteLineSubType | null;
  description: string | null;
  amount: number;
};

export type Quote = {
  id: string;
  version: QuoteVersion;
  origin: QuoteOrigin;
  status: QuoteStatus;
  hourlyRatePaint: number | null;
  hourlyRateAssembly: number | null;
  total: number;
  copiedFromQuoteId: string | null;
  lines: QuoteLine[];
};

export type RuleResult<Plan> = ({ ok: true } & Plan) | { ok: false; error: string };

/** A validated quote is the approved basis for the assessment and can no longer change. */
export function canEditQuote(quote: Quote | null): boolean {
  return quote?.status !== "validated";
}

/**
 * UC-21: copies all pre-calculation lines to the post-calculation. A draft
 * post-calculation is replaced; a validated one never.
 */
export function planCopyToPost(
  pre: Quote | null,
  post: Quote | null,
): RuleResult<{ origin: QuoteOrigin; replaces: number; copiedFromQuoteId: string }> {
  if (!pre || pre.lines.length === 0) {
    return { ok: false, error: "The pre-calculation has no lines to copy." };
  }
  if (!canEditQuote(post)) {
    return { ok: false, error: "The post-calculation is validated and cannot be replaced." };
  }
  return { ok: true, origin: pre.origin, replaces: post?.lines.length ?? 0, copiedFromQuoteId: pre.id };
}

/**
 * UC-20: records that the estimate (pre-calculation) went to the broker. The
 * e-mail itself is sent from iteration 4 on.
 */
export function planMarkSent(pre: Quote | null): RuleResult<{ quoteId: string }> {
  if (!pre || pre.lines.length === 0) {
    return { ok: false, error: "Save the pre-calculation with its lines first." };
  }
  if (pre.status !== "draft") {
    return { ok: false, error: "The pre-calculation is already marked as sent." };
  }
  return { ok: true, quoteId: pre.id };
}
