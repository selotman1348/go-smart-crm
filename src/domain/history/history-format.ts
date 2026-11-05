import { CASE_STATUS_LABELS, type CaseStatus } from "@/domain/cases/case-status";
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/domain/documents/document-rules";
import { PARTY_ROLES, type PartyRole } from "@/domain/parties/party-roles";
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
};

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
  };
  const add = (field: string, value: unknown) => {
    if (typeof value !== "string" || !value) return;
    if (ACCOUNT_FIELDS.has(field)) ids.accounts.add(value);
    else if (USER_FIELDS.has(field)) ids.users.add(value);
    else if (field === "contact_id") ids.contacts.add(value);
    else if (field === "tag_id") ids.tags.add(value);
    else if (field === "vehicle_id") ids.vehicles.add(value);
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

/**
 * UC-37: turns audit rows (newest first) into history entries. Field changes
 * made in one save are grouped into one entry.
 */
export function formatHistory(rows: AuditRow[], names: NameLookups): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
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
