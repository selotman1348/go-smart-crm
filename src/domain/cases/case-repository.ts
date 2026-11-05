import type { Database } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/server";

import type { RepositoryError, WriteResult } from "@/domain/shared/repository";
import {
  escapeLike,
  ilikeAnyFilter,
  pageRange,
  searchTerms,
  PAGE_SIZE,
  type Page,
} from "@/domain/shared/search";
import { nextDate, zonedDayStartIso } from "@/domain/shared/time";

import type { CaseHeaderInput } from "./case-header-input";
import { OPEN_STATUS_FILTER, plateKey, type CaseListQuery } from "./case-list-query";
import type { CaseStatus } from "./case-status";

type CaseRow = Database["public"]["Tables"]["case"]["Row"];
type CaseUpdate = Database["public"]["Tables"]["case"]["Update"];

export type CaseListItem = {
  id: string;
  caseNumber: string;
  status: CaseStatus;
  onHold: boolean;
  clientName: string;
  licencePlate: string | null;
  managerName: string | null;
  damageDate: string | null;
  assignmentDate: string | null;
};

export type ClientTile = {
  clientAccountId: string;
  clientName: string;
  clientCode: string | null;
  openCases: number;
};

/** The header fields of a case (UC-09), as stored. */
export type CaseHeader = Omit<CaseHeaderInput, "tagIds" | "newTag">;

export type CaseDetail = {
  id: string;
  caseNumber: string;
  status: CaseStatus;
  onHold: boolean;
  client: { id: string; name: string; clientCode: string | null; requiresVdaPo: boolean };
  vehicle: { id: string; licencePlate: string; make: string | null; model: string | null } | null;
  header: CaseHeader;
  tagIds: string[];
};

export type Tag = { id: string; name: string };

/** Text columns of case_overview searched by free text (UC-05). */
const SEARCH_COLUMNS = [
  "case_number",
  "client_name",
  "insurer_ref",
  "broker_ref",
  "expert_ref",
  "leasing_ref",
  "policy_number",
  "vda_number",
  "po_number",
];

export function toCaseHeader(row: CaseRow): CaseHeader {
  return {
    insurerRef: row.insurer_ref,
    brokerRef: row.broker_ref,
    expertRef: row.expert_ref,
    leasingRef: row.leasing_ref,
    vdaNumber: row.vda_number,
    poNumber: row.po_number,
    policyNumber: row.policy_number,
    coverType: row.cover_type,
    vatLiablePct: row.vat_liable_pct,
    deductible: row.deductible,
    assignmentDate: row.assignment_date,
    completionDate: row.completion_date,
    collectedDate: row.collected_date,
    deliveredDate: row.delivered_date,
    appointmentEstimateAt: row.appointment_estimate_at,
    appointmentRepairAt: row.appointment_repair_at,
    vehicleInDate: row.vehicle_in_date,
    vehicleReadyDate: row.vehicle_ready_date,
    clientNotifiedDate: row.client_notified_date,
    vehicleOutDate: row.vehicle_out_date,
    managerUserId: row.manager_user_id,
    assignedToUserId: row.assigned_to_user_id,
    onHold: row.on_hold,
    onHoldReason: row.on_hold_reason,
    onHoldReasonText: row.on_hold_reason_text,
  };
}

export function toCaseHeaderRow(header: CaseHeader): CaseUpdate {
  return {
    insurer_ref: header.insurerRef,
    broker_ref: header.brokerRef,
    expert_ref: header.expertRef,
    leasing_ref: header.leasingRef,
    vda_number: header.vdaNumber,
    po_number: header.poNumber,
    policy_number: header.policyNumber,
    cover_type: header.coverType,
    vat_liable_pct: header.vatLiablePct,
    deductible: header.deductible,
    assignment_date: header.assignmentDate,
    completion_date: header.completionDate,
    collected_date: header.collectedDate,
    delivered_date: header.deliveredDate,
    appointment_estimate_at: header.appointmentEstimateAt,
    appointment_repair_at: header.appointmentRepairAt,
    vehicle_in_date: header.vehicleInDate,
    vehicle_ready_date: header.vehicleReadyDate,
    client_notified_date: header.clientNotifiedDate,
    vehicle_out_date: header.vehicleOutDate,
    manager_user_id: header.managerUserId,
    assigned_to_user_id: header.assignedToUserId,
    on_hold: header.onHold,
    on_hold_reason: header.onHoldReason,
    on_hold_reason_text: header.onHoldReasonText,
  };
}

/** The PostgREST `or` filter for one search term: text columns, or the normalised plate. */
export function caseSearchFilter(term: string): string {
  const key = plateKey(term);
  const filters = [ilikeAnyFilter(SEARCH_COLUMNS, term)];
  if (key) {
    filters.push(ilikeAnyFilter(["licence_plate_key"], key));
  }
  return filters.join(",");
}

const LIST_COLUMNS =
  "id, case_number, status, on_hold, client_name, licence_plate, manager_name, damage_date, assignment_date";

export function createCaseRepository(db: DbClient) {
  return {
    async list(query: CaseListQuery): Promise<Page<CaseListItem>> {
      const { from, to } = pageRange(query.page);
      let request = db
        .from("case_overview")
        .select(LIST_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false })
        .order("case_number", { ascending: false })
        .range(from, to);

      for (const term of searchTerms(query.search)) {
        request = request.or(caseSearchFilter(term));
      }
      if (query.status === OPEN_STATUS_FILTER) {
        request = request.neq("status", "closed");
      } else if (query.status) {
        request = request.eq("status", query.status);
      }
      if (query.clientId) {
        request = request.eq("client_account_id", query.clientId);
      }
      if (query.repairerId) {
        request = request.eq("repairer_account_id", query.repairerId);
      }
      for (const [column, fromDate, toDate] of [
        ["assignment_date", query.assignmentFrom, query.assignmentTo],
        ["damage_date", query.damageFrom, query.damageTo],
        ["completion_date", query.completionFrom, query.completionTo],
      ] as const) {
        if (fromDate) request = request.gte(column, fromDate);
        if (toDate) request = request.lte(column, toDate);
      }
      // Creation is a moment: compare with the start of the Brussels days.
      if (query.createdFrom) {
        request = request.gte("created_at", zonedDayStartIso(query.createdFrom)!);
      }
      if (query.createdTo) {
        request = request.lt("created_at", zonedDayStartIso(nextDate(query.createdTo))!);
      }

      const { data, error, count } = await request;
      if (error) {
        throw new Error(`Could not load cases: ${error.message}`);
      }
      const total = count ?? 0;
      return {
        items: data.map((row) => ({
          id: row.id!,
          caseNumber: row.case_number!,
          status: row.status!,
          onHold: row.on_hold ?? false,
          clientName: row.client_name ?? "",
          licencePlate: row.licence_plate,
          managerName: row.manager_name,
          damageDate: row.damage_date,
          assignmentDate: row.assignment_date,
        })),
        total,
        page: query.page,
        pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      };
    },

    async clientTiles(): Promise<ClientTile[]> {
      const { data, error } = await db.from("open_cases_per_client").select("*").order("client_name");
      if (error) {
        throw new Error(`Could not load open cases per client: ${error.message}`);
      }
      return data.map((row) => ({
        clientAccountId: row.client_account_id!,
        clientName: row.client_name ?? "",
        clientCode: row.client_code,
        openCases: row.open_cases ?? 0,
      }));
    },

    async getById(id: string): Promise<CaseDetail | null> {
      const { data, error } = await db
        .from("case")
        .select(
          `*,
           client:client_account_id (id, name, client_code, requires_vda_po),
           vehicle:vehicle_id (id, licence_plate, make, model),
           case_tag (tag_id)`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the case: ${error.message}`);
      }
      if (!data) {
        return null;
      }
      return {
        id: data.id,
        caseNumber: data.case_number,
        status: data.status,
        onHold: data.on_hold,
        client: {
          id: data.client.id,
          name: data.client.name,
          clientCode: data.client.client_code,
          requiresVdaPo: data.client.requires_vda_po,
        },
        vehicle: data.vehicle
          ? {
              id: data.vehicle.id,
              licencePlate: data.vehicle.licence_plate,
              make: data.vehicle.make,
              model: data.vehicle.model,
            }
          : null,
        header: toCaseHeader(data),
        tagIds: data.case_tag.map((row) => row.tag_id),
      };
    },

    async getStatus(id: string): Promise<CaseStatus | null> {
      const { data, error } = await db.from("case").select("status").eq("id", id).maybeSingle();
      if (error) {
        throw new Error(`Could not load the case: ${error.message}`);
      }
      return data?.status ?? null;
    },

    /** A client account that can receive cases (it has a client code). */
    async getClient(id: string): Promise<{ id: string; clientCode: string } | null> {
      const { data, error } = await db
        .from("account")
        .select("id, client_code")
        .eq("id", id)
        .not("client_code", "is", null)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the client: ${error.message}`);
      }
      return data?.client_code ? { id: data.id, clientCode: data.client_code } : null;
    },

    /** The client's highest case number in a year, e.g. VCR20260005. */
    async lastCaseNumber(clientCode: string, year: number): Promise<string | null> {
      const { data, error } = await db
        .from("case")
        .select("case_number")
        .like("case_number", `${escapeLike(clientCode)}${year}%`)
        .order("case_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not read the last case number: ${error.message}`);
      }
      return data?.case_number ?? null;
    },

    async create(input: {
      caseNumber: string;
      clientAccountId: string;
      ownerAccountId: string;
      managerUserId: string;
      assignedToUserId: string;
      assignmentDate: string;
    }): Promise<WriteResult> {
      const { data, error } = await db.rpc("create_case", {
        p_case_number: input.caseNumber,
        p_client_account_id: input.clientAccountId,
        p_owner_account_id: input.ownerAccountId,
        p_manager_user_id: input.managerUserId,
        p_assigned_to_user_id: input.assignedToUserId,
        p_assignment_date: input.assignmentDate,
      });
      return error ? { ok: false, error } : { ok: true, id: data };
    },

    async updateHeader(id: string, header: CaseHeader): Promise<WriteResult> {
      const { data, error } = await db
        .from("case")
        .update(toCaseHeaderRow(header))
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) {
        return { ok: false, error };
      }
      return data ? { ok: true, id: data.id } : { ok: false, error: "not_found" };
    },

    async changeStatus(
      id: string,
      from: CaseStatus,
      to: CaseStatus,
      automatic: boolean,
    ): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.rpc("change_case_status", {
        p_case_id: id,
        p_expected_status: from,
        p_new_status: to,
        p_automatic: automatic,
      });
      return error ? { ok: false, error } : { ok: true };
    },

    async listTags(): Promise<Tag[]> {
      const { data, error } = await db.from("tag").select("id, name").order("name");
      if (error) {
        throw new Error(`Could not load tags: ${error.message}`);
      }
      return data;
    },

    /** The tag with this name (ignoring case), created if it does not exist. */
    async findOrCreateTag(name: string): Promise<string> {
      const existing = await db.from("tag").select("id").ilike("name", escapeLike(name)).maybeSingle();
      if (existing.data) {
        return existing.data.id;
      }
      const created = await db.from("tag").insert({ name }).select("id").single();
      if (created.error) {
        throw new Error(`Could not create the tag: ${created.error.message}`);
      }
      return created.data.id;
    },

    async setCaseTags(caseId: string, current: string[], wanted: string[]): Promise<void> {
      const add = wanted.filter((id) => !current.includes(id));
      const remove = current.filter((id) => !wanted.includes(id));
      if (add.length > 0) {
        const { error } = await db.from("case_tag").insert(add.map((tagId) => ({ case_id: caseId, tag_id: tagId })));
        if (error) {
          throw new Error(`Could not add tags: ${error.message}`);
        }
      }
      if (remove.length > 0) {
        const { error } = await db.from("case_tag").delete().eq("case_id", caseId).in("tag_id", remove);
        if (error) {
          throw new Error(`Could not remove tags: ${error.message}`);
        }
      }
    },
  };
}

export type CaseRepository = ReturnType<typeof createCaseRepository>;
