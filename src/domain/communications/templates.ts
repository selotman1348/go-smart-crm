import type { Database } from "@/lib/supabase/database.types";

import { formatMailbox } from "@/domain/intake/inbound-message";

import type { MailParty } from "./merge-fields";

type PartyRole = Database["public"]["Enums"]["party_role"];

/** Template languages (design.md 1.11); the templates exist in each. */
export const TEMPLATE_LANGUAGES = ["en", "nl"] as const;
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<TemplateLanguage, string> = {
  en: "English",
  nl: "Dutch",
};

/** UC-13: the repair order goes out with the generated repair-order PDF. */
export const REPAIR_ORDER_TEMPLATE = "new_repair_order";
/** UC-23: "Send assessment order". */
export const EXPERT_APPOINTMENT_TEMPLATE = "expert_appointment";

/** A template's audience is the party role its e-mail goes to. */
const AUDIENCE_ROLES: Record<string, PartyRole> = {
  repairer: "repairer",
  driver: "driver",
  expert: "expert",
  intermediary: "intermediary",
};

/** The next step after some templates; the user sets the status (only BR-03 is automatic). */
export const STATUS_HINTS: Record<string, string> = {
  new_repair_order: "After the repair order, notify the driver and the intermediary (UC-14, UC-15).",
  new_file_intermediary: "After sending, set the status to “File follow-up – repairer” (UC-15).",
  expert_appointment: "After sending, set the status to “File follow-up – expert” (UC-23).",
};

/** The addressee's e-mail: the contact person's, otherwise the organisation's. */
export function partyMailbox(party: MailParty): string | null {
  if (party.email) {
    return formatMailbox(party.email, party.contactName ?? party.accountName);
  }
  return null;
}

/** Default To addresses for a template's audience: every party with that role. */
export function recipientsFor(audience: string | null, parties: MailParty[]): string[] {
  const role = audience ? AUDIENCE_ROLES[audience] : undefined;
  if (!role) {
    return [];
  }
  const mailboxes = parties.filter((party) => party.role === role).map(partyMailbox);
  return [...new Set(mailboxes.filter((mailbox): mailbox is string => mailbox !== null))];
}
