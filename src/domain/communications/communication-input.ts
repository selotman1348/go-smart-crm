import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";

import { mailboxAddress } from "@/domain/intake/inbound-message";
import { normalizeCaseNumber } from "@/domain/intake/case-number-match";
import { checkbox, fieldErrorsOf, optionalText, requiredText, stringList, type FieldErrors } from "@/domain/shared/input";
import { zonedLocalToIso } from "@/domain/shared/time";

export type CommunicationChannel = Database["public"]["Enums"]["communication_channel"];
export type CommunicationDirection = Database["public"]["Enums"]["communication_direction"];

/** UC-35: the log filters. */
export const COMMUNICATION_FILTERS = ["all", "email_in", "email_out", "phone", "other"] as const;
export type CommunicationFilter = (typeof COMMUNICATION_FILTERS)[number];

export const COMMUNICATION_FILTER_LABELS: Record<CommunicationFilter, string> = {
  all: "All",
  email_in: "E-mails in",
  email_out: "E-mails out",
  phone: "Phone calls",
  other: "Other",
};

export function parseCommunicationFilter(value: unknown): CommunicationFilter {
  return (COMMUNICATION_FILTERS as readonly unknown[]).includes(value) ? (value as CommunicationFilter) : "all";
}

/** The channel and direction a filter selects (null: any). */
export function filterCriteria(filter: CommunicationFilter): {
  channel: CommunicationChannel | null;
  direction: CommunicationDirection | null;
} {
  switch (filter) {
    case "email_in":
      return { channel: "email", direction: "in" };
    case "email_out":
      return { channel: "email", direction: "out" };
    case "phone":
      return { channel: "phone", direction: null };
    case "other":
      return { channel: "other", direction: null };
    default:
      return { channel: null, direction: null };
  }
}

export const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  email: "E-mail",
  phone: "Phone call",
  other: "Other",
};

export const DIRECTION_LABELS: Record<CommunicationDirection, string> = {
  in: "In",
  out: "Out",
};

const MAX_ADDRESSES = 50;
const isEmail = (value: string) => z.email().safeParse(value).success;

/**
 * Addresses separated by commas, semicolons or new lines; each one either
 * "name@example.com" or "Name <name@example.com>".
 */
export function parseAddressList(text: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  const entries = (typeof text === "string" ? text : "")
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length > MAX_ADDRESSES) {
    return { ok: false, error: `Use at most ${MAX_ADDRESSES} addresses.` };
  }
  const invalid = entries.find((entry) => !isEmail(mailboxAddress(entry)));
  if (invalid) {
    return { ok: false, error: `“${invalid}” is not a valid e-mail address.` };
  }
  return { ok: true, value: [...new Set(entries)] };
}

/** Case numbers separated by commas or spaces (BR-12: one e-mail, several cases). */
export function parseCaseNumbers(text: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  const entries = (typeof text === "string" ? text : "").split(/[\s,;]+/).filter(Boolean);
  const numbers: string[] = [];
  for (const entry of entries) {
    const number = normalizeCaseNumber(entry);
    if (!number) {
      return { ok: false, error: `“${entry}” is not a case number.` };
    }
    numbers.push(number);
  }
  return { ok: true, value: [...new Set(numbers)] };
}

// ---------------------------------------------------------------------------
// UC-35: log a phone call or other contact
// ---------------------------------------------------------------------------

const logSchema = z.object({
  channel: z.enum(["phone", "other"], { error: "Choose phone call or other." }),
  direction: z.enum(["in", "out"], { error: "Choose incoming or outgoing." }),
  subject: requiredText("Enter a subject.", 300),
  body: optionalText(20_000),
  occurredAt: z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? zonedLocalToIso(value.trim()) ?? "invalid" : null),
    z.iso.datetime({ offset: true, error: "Enter a valid date and time." }).nullable(),
  ),
});

export type LogInput = z.output<typeof logSchema>;
export type LogField = keyof LogInput;

export function parseLogInput(input: unknown): { ok: true; value: LogInput } | { ok: false; fieldErrors: FieldErrors<LogField> } {
  const parsed = logSchema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
}

// ---------------------------------------------------------------------------
// UC-33: compose and send an e-mail
// ---------------------------------------------------------------------------

export type ComposeField = "to" | "cc" | "bcc" | "subject" | "body" | "documentIds" | "linkCaseNumbers";

export type ComposeInput = {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachRepairOrder: boolean;
  documentIds: string[];
  linkCaseNumbers: string[];
};

const composeTextSchema = z.object({
  subject: requiredText("Enter a subject.", 300),
  body: requiredText("Enter the message.", 50_000),
  attachRepairOrder: checkbox,
  documentIds: z.preprocess(stringList, z.array(z.uuid({ error: "Choose valid documents." })).max(20)),
});

/**
 * The compose form. Sending needs at least one To address; a draft may be
 * saved without one.
 */
export function parseComposeInput(
  input: Record<string, unknown>,
  options: { sending: boolean },
): { ok: true; value: ComposeInput } | { ok: false; fieldErrors: FieldErrors<ComposeField> } {
  const fieldErrors: FieldErrors<ComposeField> = {};
  const lists: Partial<Record<"to" | "cc" | "bcc", string[]>> = {};
  for (const field of ["to", "cc", "bcc"] as const) {
    const parsed = parseAddressList(input[field]);
    if (parsed.ok) {
      lists[field] = parsed.value;
    } else {
      fieldErrors[field] = [parsed.error];
    }
  }
  if (options.sending && lists.to?.length === 0) {
    fieldErrors.to = ["Enter at least one recipient."];
  }
  const caseNumbers = parseCaseNumbers(input.linkCaseNumbers);
  if (!caseNumbers.ok) {
    fieldErrors.linkCaseNumbers = [caseNumbers.error];
  }
  const text = composeTextSchema.safeParse(input);
  if (!text.success) {
    Object.assign(fieldErrors, fieldErrorsOf<ComposeField>(text.error));
  }
  if (Object.keys(fieldErrors).length > 0 || !text.success || !caseNumbers.ok) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    value: {
      to: lists.to ?? [],
      cc: lists.cc ?? [],
      bcc: lists.bcc ?? [],
      subject: text.data.subject,
      body: text.data.body,
      attachRepairOrder: text.data.attachRepairOrder,
      documentIds: text.data.documentIds,
      linkCaseNumbers: caseNumbers.value,
    },
  };
}
