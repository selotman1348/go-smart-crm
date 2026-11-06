import type { Database } from "@/lib/supabase/database.types";

import { formatDate, formatDateTime } from "@/domain/shared/time";

type PartyRole = Database["public"]["Enums"]["party_role"];

/** A party of the case with what e-mails and the repair order need. */
export type MailParty = {
  role: PartyRole;
  accountName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  invoicingConditions: string | null;
  discountPct: number | null;
};

/** What templates and the repair order are filled from. */
export type CaseMailContext = {
  caseId: string;
  caseNumber: string;
  insurerRef: string | null;
  brokerRef: string | null;
  expertRef: string | null;
  policyNumber: string | null;
  vdaNumber: string | null;
  poNumber: string | null;
  appointmentRepairAt: string | null;
  client: { name: string; address: string | null } | null;
  vehicle: {
    licencePlate: string | null;
    make: string | null;
    model: string | null;
    vin: string | null;
    firstRegistrationDate: string | null;
  } | null;
  damage: {
    date: string | null;
    cause: string | null;
    circumstances: string | null;
    extraInfo: string | null;
    parts: string[];
  } | null;
  parties: MailParty[];
};

export type MergeData = Record<string, string | null>;

/** The merge fields templates can use, as {{field}}, with a label for missing-data notes. */
export const MERGE_FIELD_LABELS: Record<string, string> = {
  "case.number": "Case number",
  "case.insurerRef": "Insurer reference",
  "case.brokerRef": "Broker reference",
  "case.expertRef": "Expert reference",
  "case.policyNumber": "Policy number",
  "case.appointmentRepair": "Repair appointment",
  "client.name": "Client",
  "vehicle.licencePlate": "Licence plate",
  "vehicle.make": "Vehicle make",
  "vehicle.model": "Vehicle model",
  "vehicle.vin": "VIN",
  "damage.date": "Damage date",
  "driver.name": "Driver",
  "repairer.name": "Repairer",
  "repairer.address": "Repairer address",
  "repairer.phone": "Repairer phone",
  "repairer.invoicingConditions": "Repairer invoicing conditions",
  "repairer.discountPct": "Repairer discount",
  "intermediary.name": "Intermediary",
  "expert.name": "Expert",
  "user.fullName": "Your name",
  "user.signature": "Your signature",
};

/** The first party with this role. */
export function partyOf(context: Pick<CaseMailContext, "parties">, role: PartyRole): MailParty | null {
  return context.parties.find((party) => party.role === role) ?? null;
}

/** People go by their contact name, organisations by their account name. */
function personName(party: MailParty | null): string | null {
  return party ? (party.contactName ?? party.accountName) : null;
}

function organisationName(party: MailParty | null): string | null {
  return party ? (party.accountName ?? party.contactName) : null;
}

/** Merge data for a case's e-mails (UC-33), as text. */
export function buildMergeData(
  context: CaseMailContext,
  user: { fullName: string; signature: string | null },
): MergeData {
  const repairer = partyOf(context, "repairer");
  return {
    "case.number": context.caseNumber,
    "case.insurerRef": context.insurerRef,
    "case.brokerRef": context.brokerRef,
    "case.expertRef": context.expertRef,
    "case.policyNumber": context.policyNumber,
    "case.appointmentRepair": context.appointmentRepairAt ? formatDateTime(context.appointmentRepairAt) : null,
    "client.name": context.client?.name ?? null,
    "vehicle.licencePlate": context.vehicle?.licencePlate ?? null,
    "vehicle.make": context.vehicle?.make ?? null,
    "vehicle.model": context.vehicle?.model ?? null,
    "vehicle.vin": context.vehicle?.vin ?? null,
    "damage.date": context.damage?.date ? formatDate(context.damage.date) : null,
    "driver.name": personName(partyOf(context, "driver")),
    "repairer.name": organisationName(repairer),
    "repairer.address": repairer?.address ?? null,
    "repairer.phone": repairer?.phone ?? null,
    "repairer.invoicingConditions": repairer?.invoicingConditions ?? null,
    "repairer.discountPct": repairer?.discountPct === null || repairer?.discountPct === undefined ? null : String(repairer.discountPct),
    "intermediary.name": organisationName(partyOf(context, "intermediary")),
    "expert.name": organisationName(partyOf(context, "expert")),
    "user.fullName": user.fullName,
    "user.signature": user.signature,
  };
}

const MERGE_FIELD = /\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}/g;

/**
 * Fills {{field}} placeholders. A field without a value is left empty and
 * reported in `missing`, so the user can complete the text before sending;
 * unknown fields are left as they are.
 */
export function renderTemplate(text: string, data: MergeData): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const rendered = text.replace(MERGE_FIELD, (placeholder, field: string) => {
    if (!(field in MERGE_FIELD_LABELS)) {
      return placeholder;
    }
    const value = data[field];
    if (value === null || value === undefined || value.trim() === "") {
      missing.add(field);
      return "";
    }
    return value;
  });
  return { text: rendered, missing: [...missing] };
}
