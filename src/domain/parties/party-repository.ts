import type { DbClient } from "@/lib/supabase/server";

import type { AccountType } from "@/domain/accounts/account-types";
import type { RepositoryError, WriteResult } from "@/domain/shared/repository";

import type { PartyInput } from "./party-input";
import type { PartyRole } from "./party-roles";

export type CaseParty = {
  id: string;
  role: PartyRole;
  isInvoiceParty: boolean;
  accountId: string | null;
  accountName: string | null;
  contactId: string | null;
  contactName: string | null;
};

export type ContactOption = { id: string; name: string; accountId: string };

export function contactName(contact: { first_name: string | null; last_name: string }): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

export function createPartyRepository(db: DbClient) {
  return {
    async listForCase(caseId: string): Promise<CaseParty[]> {
      const { data, error } = await db
        .from("case_party")
        .select(
          `id, role, is_invoice_party, account_id, contact_id,
           account:account_id (name),
           contact:contact_id (first_name, last_name)`,
        )
        .eq("case_id", caseId)
        .order("created_at");
      if (error) {
        throw new Error(`Could not load the parties: ${error.message}`);
      }
      return data.map((row) => ({
        id: row.id,
        role: row.role,
        isInvoiceParty: row.is_invoice_party ?? false,
        accountId: row.account_id,
        accountName: row.account?.name ?? null,
        contactId: row.contact_id,
        contactName: row.contact ? contactName(row.contact) : null,
      }));
    },

    async contactOptions(): Promise<ContactOption[]> {
      const { data, error } = await db
        .from("contact")
        .select("id, first_name, last_name, account_id")
        .order("last_name")
        .order("first_name")
        .limit(2000);
      if (error) {
        throw new Error(`Could not load contacts: ${error.message}`);
      }
      return data.map((row) => ({ id: row.id, name: contactName(row), accountId: row.account_id }));
    },

    async accountTypes(accountId: string): Promise<AccountType[] | null> {
      const { data, error } = await db.from("account").select("account_type").eq("id", accountId).maybeSingle();
      if (error) {
        throw new Error(`Could not load the account: ${error.message}`);
      }
      return data?.account_type ?? null;
    },

    async contactAccountId(contactId: string): Promise<string | null> {
      const { data, error } = await db.from("contact").select("account_id").eq("id", contactId).maybeSingle();
      if (error) {
        throw new Error(`Could not load the contact: ${error.message}`);
      }
      return data?.account_id ?? null;
    },

    async add(caseId: string, party: PartyInput): Promise<WriteResult> {
      const { data, error } = await db
        .from("case_party")
        .insert({ case_id: caseId, role: party.role, account_id: party.accountId, contact_id: party.contactId })
        .select("id")
        .single();
      return error ? { ok: false, error } : { ok: true, id: data.id };
    },

    async remove(caseId: string, partyId: string): Promise<{ ok: true } | { ok: false; error: RepositoryError | "not_found" }> {
      const { data, error } = await db
        .from("case_party")
        .delete()
        .eq("case_id", caseId)
        .eq("id", partyId)
        .select("id");
      if (error) {
        return { ok: false, error };
      }
      return data.length > 0 ? { ok: true } : { ok: false, error: "not_found" };
    },
  };
}

export type PartyRepository = ReturnType<typeof createPartyRepository>;
