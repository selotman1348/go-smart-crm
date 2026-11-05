import type { Database } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/server";

import type { WriteResult } from "@/domain/shared/repository";
import {
  ilikeAnyFilter,
  pageRange,
  searchTerms,
  PAGE_SIZE,
  type Page,
} from "@/domain/shared/search";

import type { ContactInput } from "./contact-input";

type ContactRow = Database["public"]["Tables"]["contact"]["Row"];
type ContactWrite = Database["public"]["Tables"]["contact"]["Insert"];

export type Contact = {
  id: string;
  accountId: string;
  accountName: string;
  salutation: string | null;
  firstName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  updatedAt: string;
};

export type ContactListItem = Pick<
  Contact,
  "id" | "accountId" | "accountName" | "firstName" | "lastName" | "email" | "phone"
>;

export type ContactListQuery = { search?: string; page: number };

const CONTACT_COLUMNS = "*, account:account_id (name)";

type ContactWithAccount = ContactRow & { account: { name: string } | null };

export function toContact(row: ContactWithAccount): Contact {
  return {
    id: row.id,
    accountId: row.account_id,
    accountName: row.account?.name ?? "",
    salutation: row.salutation,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    updatedAt: row.updated_at,
  };
}

export function toContactRow(input: ContactInput): ContactWrite {
  return {
    account_id: input.accountId,
    salutation: input.salutation,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
  };
}

export function createContactRepository(db: DbClient) {
  return {
    async list(query: ContactListQuery): Promise<Page<ContactListItem>> {
      const { from, to } = pageRange(query.page);
      let request = db
        .from("contact")
        .select(CONTACT_COLUMNS, { count: "exact" })
        .order("last_name")
        .order("first_name")
        .order("id")
        .range(from, to);
      for (const term of searchTerms(query.search)) {
        request = request.or(ilikeAnyFilter(["first_name", "last_name", "email", "phone"], term));
      }

      const { data, error, count } = await request;
      if (error) {
        throw new Error(`Could not load contacts: ${error.message}`);
      }
      const total = count ?? 0;
      return {
        items: data.map(toContact),
        total,
        page: query.page,
        pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      };
    },

    async listByAccount(accountId: string): Promise<ContactListItem[]> {
      const { data, error } = await db
        .from("contact")
        .select(CONTACT_COLUMNS)
        .eq("account_id", accountId)
        .order("last_name")
        .order("first_name");
      if (error) {
        throw new Error(`Could not load contacts: ${error.message}`);
      }
      return data.map(toContact);
    },

    async getById(id: string): Promise<Contact | null> {
      const { data, error } = await db
        .from("contact")
        .select(CONTACT_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the contact: ${error.message}`);
      }
      return data ? toContact(data) : null;
    },

    async create(input: ContactInput): Promise<WriteResult> {
      const { data, error } = await db
        .from("contact")
        .insert(toContactRow(input))
        .select("id")
        .single();
      return error ? { ok: false, error } : { ok: true, id: data.id };
    },

    async update(id: string, input: ContactInput): Promise<WriteResult> {
      const { data, error } = await db
        .from("contact")
        .update(toContactRow(input))
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) {
        return { ok: false, error };
      }
      return data ? { ok: true, id: data.id } : { ok: false, error: "not_found" };
    },
  };
}

export type ContactRepository = ReturnType<typeof createContactRepository>;
