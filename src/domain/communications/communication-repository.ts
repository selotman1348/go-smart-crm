import type { Database, Json } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/server";

import { DOCUMENT_BUCKET, type DocumentCategory } from "@/domain/documents/document-rules";
import type { NewDocument } from "@/domain/intake/inbound-repository";
import type { RepositoryError } from "@/domain/shared/repository";

import { filterCriteria, type CommunicationChannel, type CommunicationDirection, type CommunicationFilter } from "./communication-input";
import type { CaseMailContext, MergeData } from "./merge-fields";

export type OutboundStatus = Database["public"]["Enums"]["outbound_message_status"];

export type CommunicationItem = {
  id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject: string | null;
  body: string | null;
  from: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  sentAt: string | null;
  processed: boolean;
  templateName: string | null;
  loggedBy: string | null;
  /** The other cases it is linked to (BR-12). */
  otherCases: { id: string; caseNumber: string }[];
  attachments: { id: string; fileName: string }[];
};

export type TemplateSummary = { id: string; code: string; name: string; language: string; audience: string | null };
export type Template = TemplateSummary & { subject: string; body: string };

export type OutboundMessage = {
  id: string;
  caseId: string;
  templateId: string | null;
  templateCode: string | null;
  templateName: string | null;
  language: string | null;
  status: OutboundStatus;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  mergeData: MergeData;
  createdAt: string;
};

export type CaseDocumentOption = {
  id: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  category: DocumentCategory;
  storagePath: string;
};

type ContextRow = {
  id: string;
  case_number: string;
  insurer_ref: string | null;
  broker_ref: string | null;
  expert_ref: string | null;
  policy_number: string | null;
  vda_number: string | null;
  po_number: string | null;
  appointment_repair_at: string | null;
  client: AccountRow | null;
  vehicle: {
    licence_plate: string | null;
    make: string | null;
    model: string | null;
    vin: string | null;
    first_registration_date: string | null;
  } | null;
  damage: {
    damage_date: string | null;
    cause: string | null;
    circumstances: string | null;
    extra_info: string | null;
    damaged_part: { part_code: string }[];
  } | null;
  case_party: {
    role: Database["public"]["Enums"]["party_role"];
    account: AccountRow | null;
    contact: { first_name: string | null; last_name: string; email: string | null; phone: string | null } | null;
  }[];
};

type AccountRow = {
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postcode: string | null;
  city: string | null;
  invoicing_conditions: string | null;
  discount_pct: number | null;
};

const ACCOUNT_COLUMNS = "name, email, phone, address_line1, address_line2, postcode, city, invoicing_conditions, discount_pct";

function addressOf(account: AccountRow): string | null {
  const city = [account.postcode, account.city].filter(Boolean).join(" ");
  return [account.address_line1, account.address_line2, city].filter(Boolean).join(", ") || null;
}

const MESSAGE_COLUMNS =
  "id, case_id, template_id, status, to_addresses, cc_addresses, subject, body, merge_data, created_at, template:email_template (code, name, language)";

type MessageRow = {
  id: string;
  case_id: string;
  template_id: string | null;
  status: OutboundStatus;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  body: string | null;
  merge_data: Json;
  created_at: string;
  template: { code: string; name: string; language: string } | null;
};

function toMessage(row: MessageRow): OutboundMessage {
  return {
    id: row.id,
    caseId: row.case_id,
    templateId: row.template_id,
    templateCode: row.template?.code ?? null,
    templateName: row.template?.name ?? null,
    language: row.template?.language ?? null,
    status: row.status,
    to: row.to_addresses,
    cc: row.cc_addresses,
    subject: row.subject ?? "",
    body: row.body ?? "",
    mergeData: (row.merge_data ?? {}) as MergeData,
    createdAt: row.created_at,
  };
}

export function createCommunicationRepository(db: DbClient) {
  const documents = db.storage.from(DOCUMENT_BUCKET);

  return {
    /** UC-35: the case's communications, newest first. */
    async list(caseId: string, filter: CommunicationFilter): Promise<CommunicationItem[]> {
      const { channel, direction } = filterCriteria(filter);
      let request = db
        .from("communication")
        .select(
          `id, channel, direction, subject, body, from_address, to_addresses, cc_addresses, bcc_addresses, sent_at, processed,
           template:email_template (name), logger:app_user!communication_created_by_fkey (full_name),
           here:case_communication!inner (case_id),
           links:case_communication (case:case (id, case_number)),
           documents:document (id, file_name)`,
        )
        .eq("here.case_id", caseId)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (channel) {
        request = request.eq("channel", channel);
      }
      if (direction) {
        request = request.eq("direction", direction);
      }
      const { data, error } = await request;
      if (error) {
        throw new Error(`Could not load communications: ${error.message}`);
      }
      return data.map((row) => ({
        id: row.id,
        channel: row.channel,
        direction: row.direction,
        subject: row.subject,
        body: row.body,
        from: row.from_address,
        to: row.to_addresses,
        cc: row.cc_addresses,
        bcc: row.bcc_addresses,
        sentAt: row.sent_at,
        processed: row.processed,
        templateName: row.template?.name ?? null,
        loggedBy: row.logger?.full_name ?? null,
        otherCases: row.links
          .flatMap((link) => (link.case ? [{ id: link.case.id, caseNumber: link.case.case_number }] : []))
          .filter((linked) => linked.id !== caseId),
        attachments: row.documents.map((document) => ({ id: document.id, fileName: document.file_name })),
      }));
    },

    /** Whether the communication is linked to the case. */
    async isOnCase(caseId: string, communicationId: string): Promise<boolean> {
      const { data, error } = await db
        .from("case_communication")
        .select("communication_id")
        .eq("case_id", caseId)
        .eq("communication_id", communicationId)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the communication: ${error.message}`);
      }
      return data !== null;
    },

    async setProcessed(communicationId: string, processed: boolean): Promise<boolean> {
      const { data, error } = await db
        .from("communication")
        .update({ processed })
        .eq("id", communicationId)
        .select("id")
        .maybeSingle();
      return !error && data !== null;
    },

    async log(caseId: string, communication: Record<string, Json>): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.rpc("log_communication", { p_case_id: caseId, p_communication: communication });
      return error ? { ok: false, error } : { ok: true };
    },

    /** Everything templates and the repair order are filled from. */
    async caseContext(caseId: string): Promise<CaseMailContext | null> {
      const { data, error } = await db
        .from("case")
        .select(
          `id, case_number, insurer_ref, broker_ref, expert_ref, policy_number, vda_number, po_number, appointment_repair_at,
           client:account!case_client_account_id_fkey (${ACCOUNT_COLUMNS}),
           vehicle:vehicle!case_vehicle_id_fkey (licence_plate, make, model, vin, first_registration_date),
           damage (damage_date, cause, circumstances, extra_info, damaged_part (part_code)),
           case_party (role, account:account!case_party_account_id_fkey (${ACCOUNT_COLUMNS}), contact (first_name, last_name, email, phone))`,
        )
        .eq("id", caseId)
        .order("created_at", { referencedTable: "case_party", ascending: true })
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the case: ${error.message}`);
      }
      if (!data) {
        return null;
      }
      const row = data as unknown as ContextRow;
      const partCodes = row.damage?.damaged_part.map((part) => part.part_code) ?? [];
      const [parts, circumstances] = await Promise.all([
        partCodes.length > 0
          ? db.from("part_catalog").select("code, label").in("code", partCodes).order("sort_order")
          : Promise.resolve({ data: [] as { code: string; label: string }[], error: null }),
        row.damage?.circumstances
          ? db.from("circumstances").select("label").eq("code", row.damage.circumstances).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      return {
        caseId: row.id,
        caseNumber: row.case_number,
        insurerRef: row.insurer_ref,
        brokerRef: row.broker_ref,
        expertRef: row.expert_ref,
        policyNumber: row.policy_number,
        vdaNumber: row.vda_number,
        poNumber: row.po_number,
        appointmentRepairAt: row.appointment_repair_at,
        client: row.client ? { name: row.client.name, address: addressOf(row.client) } : null,
        vehicle: row.vehicle
          ? {
              licencePlate: row.vehicle.licence_plate,
              make: row.vehicle.make,
              model: row.vehicle.model,
              vin: row.vehicle.vin,
              firstRegistrationDate: row.vehicle.first_registration_date,
            }
          : null,
        damage: row.damage
          ? {
              date: row.damage.damage_date,
              cause: row.damage.cause,
              circumstances: circumstances.data?.label ?? null,
              extraInfo: row.damage.extra_info,
              parts: (parts.data ?? []).map((part) => part.label),
            }
          : null,
        parties: row.case_party.map((party) => ({
          role: party.role,
          accountName: party.account?.name ?? null,
          contactName: party.contact ? [party.contact.first_name, party.contact.last_name].filter(Boolean).join(" ") : null,
          email: party.contact?.email ?? party.account?.email ?? null,
          phone: party.contact?.phone ?? party.account?.phone ?? null,
          address: party.account ? addressOf(party.account) : null,
          invoicingConditions: party.account?.invoicing_conditions ?? null,
          discountPct: party.account?.discount_pct ?? null,
        })),
      };
    },

    async userSignature(userId: string): Promise<string | null> {
      const { data } = await db.from("app_user").select("signature").eq("id", userId).maybeSingle();
      return data?.signature ?? null;
    },

    async templates(): Promise<TemplateSummary[]> {
      const { data, error } = await db
        .from("email_template")
        .select("id, code, name, language, audience")
        .order("name")
        .order("language");
      if (error) {
        throw new Error(`Could not load the e-mail templates: ${error.message}`);
      }
      return data;
    },

    async template(code: string, language: string): Promise<Template | null> {
      const { data, error } = await db
        .from("email_template")
        .select("id, code, name, language, audience, subject, body")
        .eq("code", code)
        .eq("language", language)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the e-mail template: ${error.message}`);
      }
      return data;
    },

    async caseDocuments(caseId: string): Promise<CaseDocumentOption[]> {
      const { data, error } = await db
        .from("document")
        .select("id, file_name, mime_type, size, category, storage_path")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(`Could not load documents: ${error.message}`);
      }
      return data.map((row) => ({
        id: row.id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        size: row.size,
        category: row.category,
        storagePath: row.storage_path,
      }));
    },

    async readDocument(path: string): Promise<Uint8Array | null> {
      const { data, error } = await documents.download(path);
      return error || !data ? null : new Uint8Array(await data.arrayBuffer());
    },

    async storeDocument(path: string, content: Uint8Array, contentType: string): Promise<boolean> {
      const { error } = await documents.upload(path, content, { contentType, upsert: false });
      return !error;
    },

    async removeDocuments(paths: string[]): Promise<void> {
      if (paths.length > 0) {
        await documents.remove(paths);
      }
    },

    async casesByNumbers(numbers: string[]): Promise<{ id: string; caseNumber: string }[]> {
      if (numbers.length === 0) {
        return [];
      }
      const { data, error } = await db.from("case").select("id, case_number").in("case_number", numbers);
      if (error) {
        throw new Error(`Could not look up the cases: ${error.message}`);
      }
      return data.map((row) => ({ id: row.id, caseNumber: row.case_number }));
    },

    // -- Outbound messages (drafts → approved → sent; plan.md section 3) -----

    async createDraft(draft: {
      caseId: string;
      templateId: string | null;
      mergeData: MergeData;
      to: string[];
      subject: string;
      body: string;
    }): Promise<string> {
      const { data, error } = await db
        .from("outbound_message")
        .insert({
          case_id: draft.caseId,
          template_id: draft.templateId,
          merge_data: draft.mergeData,
          to_addresses: draft.to,
          subject: draft.subject,
          body: draft.body,
        })
        .select("id")
        .single();
      if (error) {
        throw new Error(`Could not create the draft: ${error.message}`);
      }
      return data.id;
    },

    async message(id: string): Promise<OutboundMessage | null> {
      const { data, error } = await db.from("outbound_message").select(MESSAGE_COLUMNS).eq("id", id).maybeSingle();
      if (error) {
        throw new Error(`Could not load the message: ${error.message}`);
      }
      return data ? toMessage(data as MessageRow) : null;
    },

    /** Drafts and failed messages of the case, newest first. */
    async openMessages(caseId: string): Promise<OutboundMessage[]> {
      const { data, error } = await db
        .from("outbound_message")
        .select(MESSAGE_COLUMNS)
        .eq("case_id", caseId)
        .in("status", ["draft", "failed"])
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(`Could not load the drafts: ${error.message}`);
      }
      return (data as MessageRow[]).map(toMessage);
    },

    /** Updates a message that still has one of the expected statuses. */
    async updateMessage(
      id: string,
      expected: OutboundStatus[],
      values: { to?: string[]; cc?: string[]; subject?: string; body?: string; status?: OutboundStatus; approvedBy?: string },
    ): Promise<boolean> {
      const { data, error } = await db
        .from("outbound_message")
        .update({
          to_addresses: values.to,
          cc_addresses: values.cc,
          subject: values.subject,
          body: values.body,
          status: values.status,
          approved_by: values.approvedBy,
        })
        .eq("id", id)
        .in("status", expected)
        .select("id")
        .maybeSingle();
      return !error && data !== null;
    },

    async deleteMessage(id: string): Promise<boolean> {
      const { data, error } = await db
        .from("outbound_message")
        .delete()
        .eq("id", id)
        .in("status", ["draft", "failed"])
        .select("id")
        .maybeSingle();
      return !error && data !== null;
    },

    async recordSent(
      messageId: string,
      otherCaseIds: string[],
      communication: Record<string, Json>,
      generated: NewDocument[],
    ): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.rpc("record_message_sent", {
        p_message_id: messageId,
        p_case_ids: otherCaseIds,
        p_communication: communication,
        p_documents: generated.map((document) => ({
          id: document.id,
          file_name: document.fileName,
          size: document.size,
          mime_type: document.mimeType,
          category: document.category,
          storage_path: document.storagePath,
        })),
      });
      return error ? { ok: false, error } : { ok: true };
    },
  };
}

export type CommunicationRepository = ReturnType<typeof createCommunicationRepository>;
