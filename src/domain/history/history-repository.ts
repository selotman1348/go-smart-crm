import type { DbClient } from "@/lib/supabase/server";

import { contactName } from "@/domain/parties/party-repository";

import { QUOTE_VERSION_LABELS } from "@/domain/quotes/quote-lines";

import type { AuditRow, NameLookups } from "./history-format";

const LOOKUP_TABLES = ["on_hold_reason", "no_repair_reason", "liability", "circumstances", "part_catalog"] as const;

export function createHistoryRepository(db: DbClient) {
  async function names<Row>(
    table: "account" | "contact" | "app_user" | "tag" | "vehicle" | "document",
    columns: string,
    ids: Set<string>,
    toName: (row: Row) => string,
  ): Promise<Map<string, string>> {
    if (ids.size === 0) {
      return new Map();
    }
    const { data, error } = await db.from(table).select(columns).in("id", [...ids]);
    if (error) {
      throw new Error(`Could not load names for the history: ${error.message}`);
    }
    return new Map((data as unknown as (Row & { id: string })[]).map((row) => [row.id, toName(row)]));
  }

  return {
    async caseVehicleId(caseId: string): Promise<{ exists: boolean; vehicleId: string | null }> {
      const { data, error } = await db.from("case").select("vehicle_id").eq("id", caseId).maybeSingle();
      if (error) {
        throw new Error(`Could not load the case: ${error.message}`);
      }
      return { exists: data !== null, vehicleId: data?.vehicle_id ?? null };
    },

    /** Audit rows of the case and of its vehicle, newest first. */
    async auditRows(caseId: string, vehicleId: string | null): Promise<AuditRow[]> {
      const scope = vehicleId
        ? `case_id.eq.${caseId},and(entity.eq.vehicle,entity_id.eq.${vehicleId})`
        : `case_id.eq.${caseId}`;
      const { data, error } = await db
        .from("audit_log")
        .select("id, entity, entity_id, field, old_value, new_value, actor_type, actor_id, at")
        .or(scope)
        .order("at", { ascending: false })
        .order("entity")
        .order("entity_id")
        .limit(500);
      if (error) {
        throw new Error(`Could not load the history: ${error.message}`);
      }
      return data.map((row) => ({
        id: row.id,
        entity: row.entity,
        entityId: row.entity_id,
        field: row.field,
        oldValue: row.old_value,
        newValue: row.new_value,
        actorType: row.actor_type,
        actorId: row.actor_id,
        at: row.at,
      }));
    },

    async nameLookups(
      caseId: string,
      ids: {
        accounts: Set<string>;
        contacts: Set<string>;
        users: Set<string>;
        tags: Set<string>;
        vehicles: Set<string>;
        documents: Set<string>;
      },
    ): Promise<NameLookups> {
      const quotes = await db.from("quote").select("id, version").eq("case_id", caseId);
      if (quotes.error) {
        throw new Error(`Could not load the quotes for the history: ${quotes.error.message}`);
      }
      const [accounts, contacts, users, tags, vehicles, documents, ...codeLists] = await Promise.all([
        names<{ name: string }>("account", "id, name", ids.accounts, (row) => row.name),
        names<{ first_name: string | null; last_name: string }>(
          "contact",
          "id, first_name, last_name",
          ids.contacts,
          contactName,
        ),
        names<{ full_name: string }>("app_user", "id, full_name", ids.users, (row) => row.full_name),
        names<{ name: string }>("tag", "id, name", ids.tags, (row) => row.name),
        names<{ licence_plate: string }>("vehicle", "id, licence_plate", ids.vehicles, (row) => row.licence_plate),
        names<{ file_name: string }>("document", "id, file_name", ids.documents, (row) => row.file_name),
        ...LOOKUP_TABLES.map(async (table) => {
          const { data, error } = await db.from(table).select("code, label");
          if (error) {
            throw new Error(`Could not load ${table}: ${error.message}`);
          }
          return new Map(data.map((row) => [row.code, row.label]));
        }),
      ]);
      return {
        accounts,
        contacts,
        users,
        tags,
        vehicles,
        documents,
        quotes: new Map(quotes.data.map((quote) => [quote.id, QUOTE_VERSION_LABELS[quote.version]])),
        codes: new Map(LOOKUP_TABLES.map((table, index) => [table, codeLists[index]])),
      };
    },
  };
}

export type HistoryRepository = ReturnType<typeof createHistoryRepository>;
