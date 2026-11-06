import { CASE_STATUS_LABELS, type CaseStatus } from "@/domain/cases/case-status";
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/domain/documents/document-rules";
import { PARTY_ROLES, type PartyRole } from "@/domain/parties/party-roles";
import {
  CATEGORY_LABELS,
  QUOTE_ORIGIN_LABELS,
  QUOTE_STATUS_LABELS,
  QUOTE_VERSION_LABELS,
  SUB_TYPE_LABELS,
  type QuoteLineCategory,
  type QuoteLineSubType,
  type QuoteOrigin,
  type QuoteStatus,
  type QuoteVersion,
} from "@/domain/quotes/quote-lines";
import { ASSESSMENT_TYPE_LABELS, type AssessmentType } from "@/domain/quotes/validation";
import { formatMoney } from "@/domain/shared/money";
import { formatDate, formatDateTime } from "@/domain/shared/time";
import { VEHICLE_CATEGORY_LABELS, type VehicleCategory } from "@/domain/vehicles/vehicle-input";

/** One audit_log row (design.md 1.12). */
export type AuditRow = {
  id: string;
  entity: string;
  entityId: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actorType: "user" | "system" | "agent";
  actorId: string | null;
  at: string;
};

export type NameLookups = {
  accounts: Map<string, string>;
  contacts: Map<string, string>;
  users: Map<string, string>;
  tags: Map<string, string>;
  vehicles: Map<string, string>;
  /** Quote id -> its version, e.g. "Pre-calculation". */
  quotes: Map<string, string>;
  /** Document id -> file name. */
  documents: Map<string, string>;
  codes: Map<string, Map<string, string>>;
};

export type HistoryChange = { label: string; from: string; to: string };

export type HistoryEntry = {
  key: string;
  at: string;
  actor: string;
  summary: string;
  changes: HistoryChange[];
};

const EMPTY = "—";

const ENTITY_LABELS: Record<string, string> = {
  case: "case",
  case_party: "party",
  damage: "damage",
  damaged_part: "damaged part",
  document: "document",
  case_tag: "tag",
  vehicle: "vehicle",
  quote: "quote",
  quote_line: "quote line",
  assessment: "assessment",
  invoice: "invoice",
  outbound_message: "e-mail draft",
  intake_draft: "intake draft",
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
  case: {
    status: "Status",
    vehicle_id: "Vehicle",
    insurer_ref: "Insurer ref.",
    broker_ref: "Broker ref.",
    expert_ref: "Expert ref.",
    leasing_ref: "Leasing ref.",
    vda_number: "VDA number",
    po_number: "PO number",
    policy_number: "Policy number",
    cover_type: "Cover type",
    vat_liable_pct: "VAT liable %",
    deductible: "Deductible",
    assignment_date: "Assignment date",
    completion_date: "Completion date",
    collected_date: "Collected date",
    delivered_date: "Delivered date",
    appointment_estimate_at: "Estimate appointment",
    appointment_repair_at: "Repair appointment",
    vehicle_in_date: "Vehicle in",
    vehicle_ready_date: "Vehicle ready",
    client_notified_date: "Client notified",
    vehicle_out_date: "Vehicle out",
    manager_user_id: "Case manager",
    assigned_to_user_id: "Assigned to",
    on_hold: "On hold",
    on_hold_reason: "On-hold reason",
    on_hold_reason_text: "On-hold note",
    repair_decision: "Repair decision",
    no_repair_reason: "No-repair reason",
    no_repair_reason_text: "No-repair note",
  },
  vehicle: {
    licence_plate: "Licence plate",
    vin: "VIN",
    first_registration_date: "First registration",
    make: "Make",
    model: "Model",
    model_year: "Model year",
    type_designation: "Type",
    category: "Category",
    colour: "Colour",
    paint_type: "Paint type",
    owner_account_id: "Owner",
    leasing_account_id: "Leasing company",
    power_kw: "Power (kW)",
    engine_cc: "Engine (cc)",
    co2: "CO₂ (g/km)",
    seats: "Seats",
  },
  damage: {
    damage_date: "Damage date",
    mileage_in: "Mileage in",
    mileage_out: "Mileage out",
    address_line1: "Address line 1",
    address_line2: "Address line 2",
    postcode: "Postcode",
    city: "City",
    country: "Country",
    cause: "Cause",
    liability: "Liability",
    circumstances: "Circumstances",
    extra_info: "Extra information",
  },
  document: { file_name: "File name", category: "Category" },
  quote: {
    status: "Status",
    origin: "Origin",
    hourly_rate_paint: "Hourly rate paintwork",
    hourly_rate_assembly: "Hourly rate (dis)assembly",
    total_excl_vat: "Total excl. VAT",
    copied_from_quote_id: "Copied from",
  },
  quote_line: { category: "Category", sub_type: "Sub-type", description: "Description", amount: "Amount" },
  assessment: {
    assessment_type: "Assessment type",
    expert_account_id: "Expert",
    expert_report_document_id: "Expert report",
    vat_applicable: "VAT applicable",
    approved_amount_excl_vat: "Approved amount excl. VAT",
    approved_amount_incl_vat: "Approved amount incl. VAT",
    loss_of_use_days: "Loss-of-use days",
    total_loss_vehicle_value: "Vehicle value",
    total_loss_previous_damage_deduction: "Deduction for previous damage",
    total_loss_accessories: "Accessories",
    total_loss_wreck_value: "Wreck value",
    total_loss_damage_amount: "Total damage amount",
    validated_at: "Validated at",
    validated_by: "Validated by",
  },
  invoice: {
    received: "Invoice received",
    received_date: "Received on",
    invoice_number: "Invoice number",
    amount_excl_vat: "Amount excl. VAT",
    document_id: "Invoice document",
  },
};

/** Amount fields, shown in euros. */
const MONEY_FIELDS = new Set([
  "amount",
  "deductible",
  "total_excl_vat",
  "hourly_rate_paint",
  "hourly_rate_assembly",
  "approved_amount_excl_vat",
  "approved_amount_incl_vat",
  "total_loss_vehicle_value",
  "total_loss_previous_damage_deduction",
  "total_loss_accessories",
  "total_loss_wreck_value",
  "total_loss_damage_amount",
  "amount_excl_vat",
]);

const ACCOUNT_FIELDS = new Set([
  "account_id",
  "client_account_id",
  "owner_account_id",
  "leasing_account_id",
  "expert_account_id",
]);
const USER_FIELDS = new Set(["manager_user_id", "assigned_to_user_id", "validated_by", "approved_by"]);
/** Fields holding a lookup code, and their lookup table. */
const CODE_FIELDS: Record<string, string> = {
  on_hold_reason: "on_hold_reason",
  no_repair_reason: "no_repair_reason",
  liability: "liability",
  circumstances: "circumstances",
  part_code: "part_catalog",
};
const REPAIR_DECISION_LABELS: Record<string, string> = {
  repair: "Repair",
  no_repair: "No repair",
  total_loss: "Total loss",
};

function humanize(field: string): string {
  const text = field.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fieldLabel(entity: string, field: string): string {
  return FIELD_LABELS[entity]?.[field] ?? humanize(field);
}

/** A stored value as people read it: names instead of ids, labels instead of codes. */
export function formatValue(entity: string, field: string, raw: unknown, names: NameLookups): string {
  if (raw === null || raw === undefined || raw === "") {
    return EMPTY;
  }
  const value = String(raw);
  if (ACCOUNT_FIELDS.has(field)) return names.accounts.get(value) ?? "Unknown account";
  if (USER_FIELDS.has(field)) return names.users.get(value) ?? "Unknown user";
  if (field === "contact_id") return names.contacts.get(value) ?? "Unknown contact";
  if (field === "tag_id") return names.tags.get(value) ?? "Unknown tag";
  if (field === "vehicle_id") return names.vehicles.get(value) ?? "Unknown vehicle";
  if (field === "copied_from_quote_id") return names.quotes.get(value) ?? "Another quote";
  if (field === "expert_report_document_id" || field === "document_id") {
    return names.documents.get(value) ?? "A removed document";
  }
  if (MONEY_FIELDS.has(field) && !Number.isNaN(Number(value))) return formatMoney(Number(value));
  if (entity === "quote" && field === "status") return QUOTE_STATUS_LABELS[value as QuoteStatus] ?? value;
  if (entity === "quote" && field === "origin") return QUOTE_ORIGIN_LABELS[value as QuoteOrigin] ?? value;
  if (field === "version") return QUOTE_VERSION_LABELS[value as QuoteVersion] ?? value;
  if (entity === "quote_line" && field === "category") return CATEGORY_LABELS[value as QuoteLineCategory] ?? value;
  if (field === "sub_type") return SUB_TYPE_LABELS[value as QuoteLineSubType] ?? value;
  if (field === "assessment_type") return ASSESSMENT_TYPE_LABELS[value as AssessmentType] ?? value;
  if (field in CODE_FIELDS) return names.codes.get(CODE_FIELDS[field])?.get(value) ?? value;
  if (field === "status" || field === "from_status" || field === "to_status") {
    return CASE_STATUS_LABELS[value as CaseStatus] ?? value;
  }
  if (field === "role") return PARTY_ROLES[value as PartyRole]?.label ?? value;
  if (field === "repair_decision") return REPAIR_DECISION_LABELS[value] ?? value;
  if (field === "category" && entity === "vehicle") return VEHICLE_CATEGORY_LABELS[value as VehicleCategory] ?? value;
  if (field === "category" && entity === "document") {
    return DOCUMENT_CATEGORY_LABELS[value as DocumentCategory] ?? value;
  }
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return formatDateTime(value);
  return value;
}

function parseRecord(json: string | null): Record<string, unknown> {
  if (!json) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Ids the entries refer to, so their names can be loaded in one go. */
export function referencedIds(rows: AuditRow[]) {
  const ids = {
    accounts: new Set<string>(),
    contacts: new Set<string>(),
    users: new Set<string>(),
    tags: new Set<string>(),
    vehicles: new Set<string>(),
    documents: new Set<string>(),
  };
  const add = (field: string, value: unknown) => {
    if (typeof value !== "string" || !value) return;
    if (ACCOUNT_FIELDS.has(field)) ids.accounts.add(value);
    else if (USER_FIELDS.has(field)) ids.users.add(value);
    else if (field === "contact_id") ids.contacts.add(value);
    else if (field === "tag_id") ids.tags.add(value);
    else if (field === "vehicle_id") ids.vehicles.add(value);
    else if (field === "expert_report_document_id" || field === "document_id") ids.documents.add(value);
  };
  for (const row of rows) {
    if (row.actorId) ids.users.add(row.actorId);
    if (row.field) {
      add(row.field, row.oldValue);
      add(row.field, row.newValue);
    } else {
      for (const [field, value] of Object.entries(parseRecord(row.newValue ?? row.oldValue))) {
        add(field, value);
      }
    }
  }
  return ids;
}

function actorName(row: AuditRow, names: NameLookups): string {
  if (row.actorType === "system") return "System";
  if (row.actorType === "agent") return "API client";
  return (row.actorId && names.users.get(row.actorId)) || "Unknown user";
}

/** Summary of an added (or removed) record, e.g. "Added party Repairer: Riverside Body Shop BV". */
function recordSummary(row: AuditRow, names: NameLookups): string {
  const added = row.oldValue === null;
  const record = parseRecord(added ? row.newValue : row.oldValue);
  const value = (field: string) => formatValue(row.entity, field, record[field], names);
  switch (row.entity) {
    case "case":
      return added ? `Created the case ${String(record.case_number ?? "")}`.trim() : "Deleted the case";
    case "case_party": {
      const who = [record.account_id ? value("account_id") : null, record.contact_id ? value("contact_id") : null]
        .filter(Boolean)
        .join(" – ");
      return `${added ? "Added" : "Removed"} party ${value("role")}: ${who}`;
    }
    case "damage":
      return added ? "Recorded the damage" : "Removed the damage";
    case "damaged_part":
      return `${added ? "Added" : "Removed"} damaged part: ${value("part_code")}`;
    case "document":
      return `${added ? "Uploaded" : "Removed"} document ${String(record.file_name ?? "")} (${value("category")})`;
    case "case_tag":
      return `${added ? "Added" : "Removed"} tag ${value("tag_id")}`;
    case "vehicle":
      return added ? `Added vehicle ${String(record.licence_plate ?? "")}`.trim() : "Removed the vehicle";
    case "assessment":
      return added ? "Recorded the assessment" : "Removed the assessment";
    case "invoice":
      if (record.direction === "sales") {
        return added ? `Recorded the sales invoice ${String(record.invoice_number ?? "")}`.trim() : "Removed the sales invoice";
      }
      return added ? "Recorded the repairer invoice" : "Removed the repairer invoice";
    case "outbound_message":
      // Drafts are audited only when an API client creates them (plan.md section 3).
      return `Drafted an e-mail: ${String(record.subject ?? "")}`;
    default:
      return `${added ? "Added" : "Removed"} ${ENTITY_LABELS[row.entity] ?? row.entity}`;
  }
}

function updateSummary(entity: string, changes: AuditRow[]): string {
  if (entity === "case" && changes.every((change) => change.field === "status")) {
    return "Changed the status";
  }
  return `Updated the ${ENTITY_LABELS[entity] ?? entity}`;
}

const QUOTE_ENTITIES = new Set(["quote", "quote_line"]);

/** "Labour – Paintwork: Paint rear bumper (€248.00)". */
function describeLine(record: Record<string, unknown>, names: NameLookups): string {
  const kind = [
    formatValue("quote_line", "category", record.category, names),
    record.sub_type ? formatValue("quote_line", "sub_type", record.sub_type, names) : null,
  ]
    .filter(Boolean)
    .join(" – ");
  const description = record.description ? `: ${String(record.description)}` : "";
  return `${kind}${description} (${formatValue("quote_line", "amount", record.amount, names)})`;
}

/** The quote a group of quote and quote-line rows belongs to. */
function quoteIdOf(group: AuditRow[]): string | undefined {
  const quoteRow = group.find((row) => row.entity === "quote");
  if (quoteRow) {
    return quoteRow.entityId;
  }
  const lineRecord = group.find((row) => !row.field);
  const quoteId = parseRecord(lineRecord?.newValue ?? lineRecord?.oldValue ?? null).quote_id;
  return typeof quoteId === "string" ? quoteId : undefined;
}

/** One entry for a quote save: the quote's own changes and its line changes. */
function quoteEntry(group: AuditRow[], names: NameLookups): HistoryEntry {
  const first = group[0];
  const quoteId = quoteIdOf(group);
  const version = (quoteId && names.quotes.get(quoteId)?.toLowerCase()) || "quote";
  const quoteRows = group.filter((row) => row.entity === "quote");
  const statusChange = quoteRows.find((row) => row.field === "status");

  let summary = `Updated the ${version}`;
  if (quoteRows.some((row) => !row.field && row.oldValue === null)) {
    summary = `Created the ${version}`;
  } else if (statusChange?.newValue === "validated") {
    summary = `Validated the ${version}`;
  } else if (statusChange?.newValue === "sent") {
    summary = `Marked the ${version} as sent`;
  }

  const changes: HistoryChange[] = [];
  // Oldest first, in the order the changes were made.
  for (const row of [...group].reverse()) {
    if (row.entity === "quote") {
      if (row.field) {
        changes.push({
          label: fieldLabel("quote", row.field),
          from: formatValue("quote", row.field, row.oldValue, names),
          to: formatValue("quote", row.field, row.newValue, names),
        });
      }
    } else if (!row.field) {
      const added = row.oldValue === null;
      const line = describeLine(parseRecord(added ? row.newValue : row.oldValue), names);
      changes.push({ label: added ? "Line added" : "Line removed", from: added ? EMPTY : line, to: added ? line : EMPTY });
    } else {
      changes.push({
        label: `Line ${fieldLabel("quote_line", row.field).toLowerCase()}`,
        from: formatValue("quote_line", row.field, row.oldValue, names),
        to: formatValue("quote_line", row.field, row.newValue, names),
      });
    }
  }
  return { key: first.id, at: first.at, actor: actorName(first, names), summary, changes };
}

/**
 * UC-37: turns audit rows (newest first) into history entries. Field changes
 * made in one save are grouped into one entry, and so are all changes of one
 * quote save.
 */
export function formatHistory(rows: AuditRow[], names: NameLookups): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (QUOTE_ENTITIES.has(row.entity)) {
      const group = [row];
      while (
        index + group.length < rows.length &&
        QUOTE_ENTITIES.has(rows[index + group.length].entity) &&
        rows[index + group.length].actorId === row.actorId &&
        // One save is one transaction, and its audit rows share its time.
        rows[index + group.length].at === row.at
      ) {
        group.push(rows[index + group.length]);
      }
      entries.push(quoteEntry(group, names));
      index += group.length;
      continue;
    }
    if (!row.field) {
      entries.push({
        key: row.id,
        at: row.at,
        actor: actorName(row, names),
        summary: recordSummary(row, names),
        changes: [],
      });
      index++;
      continue;
    }

    const group = [row];
    while (
      index + group.length < rows.length &&
      rows[index + group.length].field &&
      rows[index + group.length].entity === row.entity &&
      rows[index + group.length].entityId === row.entityId &&
      rows[index + group.length].at === row.at &&
      rows[index + group.length].actorId === row.actorId
    ) {
      group.push(rows[index + group.length]);
    }
    entries.push({
      key: row.id,
      at: row.at,
      actor: actorName(row, names),
      summary: updateSummary(row.entity, group),
      changes: group.map((change) => ({
        label: fieldLabel(change.entity, change.field!),
        from: formatValue(change.entity, change.field!, change.oldValue, names),
        to: formatValue(change.entity, change.field!, change.newValue, names),
      })),
    });
    index += group.length;
  }
  return entries;
}
