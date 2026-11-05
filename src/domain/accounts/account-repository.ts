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

import type { AccountInput } from "./account-input";
import type { AccountType } from "./account-types";

type AccountRow = Database["public"]["Tables"]["account"]["Row"];
type AccountWrite = Database["public"]["Tables"]["account"]["Insert"];

export type Account = {
  id: string;
  name: string;
  accountTypes: AccountType[];
  clientCode: string | null;
  parentAccountId: string | null;
  vatNumber: string | null;
  vatLiable: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  invoicingConditions: string | null;
  discountPct: number | null;
  requiresVdaPo: boolean;
  isNetworkMember: boolean;
  updatedAt: string;
};

export type AccountListItem = Pick<
  Account,
  "id" | "name" | "accountTypes" | "clientCode" | "city" | "phone" | "email"
>;

export type AccountOption = { id: string; name: string };

export type TypedAccountOption = AccountOption & { accountTypes: AccountType[] };

export type AccountListQuery = {
  search?: string;
  type?: AccountType;
  page: number;
};

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    accountTypes: row.account_type,
    clientCode: row.client_code,
    parentAccountId: row.parent_account_id,
    vatNumber: row.vat_number,
    vatLiable: row.vat_liable,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postcode: row.postcode,
    city: row.city,
    country: row.country,
    phone: row.phone,
    email: row.email,
    invoicingConditions: row.invoicing_conditions,
    discountPct: row.discount_pct,
    requiresVdaPo: row.requires_vda_po,
    isNetworkMember: row.is_network_member,
    updatedAt: row.updated_at,
  };
}

export function toAccountRow(input: AccountInput): AccountWrite {
  return {
    name: input.name,
    account_type: input.accountTypes,
    client_code: input.clientCode,
    parent_account_id: input.parentAccountId,
    vat_number: input.vatNumber,
    vat_liable: input.vatLiable,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2,
    postcode: input.postcode,
    city: input.city,
    country: input.country,
    phone: input.phone,
    email: input.email,
    invoicing_conditions: input.invoicingConditions,
    discount_pct: input.discountPct,
    requires_vda_po: input.requiresVdaPo,
    is_network_member: input.isNetworkMember,
  };
}

const LIST_COLUMNS = "id, name, account_type, client_code, city, phone, email";

export function createAccountRepository(db: DbClient) {
  return {
    async list(query: AccountListQuery): Promise<Page<AccountListItem>> {
      const { from, to } = pageRange(query.page);
      let request = db
        .from("account")
        .select(LIST_COLUMNS, { count: "exact" })
        .order("name")
        .order("id")
        .range(from, to);
      for (const term of searchTerms(query.search)) {
        request = request.or(ilikeAnyFilter(["name", "client_code"], term));
      }
      if (query.type) {
        request = request.contains("account_type", [query.type]);
      }

      const { data, error, count } = await request;
      if (error) {
        throw new Error(`Could not load accounts: ${error.message}`);
      }
      const total = count ?? 0;
      return {
        items: data.map((row) => ({
          id: row.id,
          name: row.name,
          accountTypes: row.account_type,
          clientCode: row.client_code,
          city: row.city,
          phone: row.phone,
          email: row.email,
        })),
        total,
        page: query.page,
        pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      };
    },

    async getById(id: string): Promise<Account | null> {
      const { data, error } = await db.from("account").select("*").eq("id", id).maybeSingle();
      if (error) {
        throw new Error(`Could not load the account: ${error.message}`);
      }
      return data ? toAccount(data) : null;
    },

    /** Accounts as picker options, optionally only those of one type. */
    async listOptions(type?: AccountType): Promise<AccountOption[]> {
      let request = db.from("account").select("id, name").order("name").limit(1000);
      if (type) {
        request = request.contains("account_type", [type]);
      }
      const { data, error } = await request;
      if (error) {
        throw new Error(`Could not load accounts: ${error.message}`);
      }
      return data;
    },

    /** All accounts with their types, for pickers that filter by type in the browser. */
    async listTypedOptions(): Promise<TypedAccountOption[]> {
      const { data, error } = await db.from("account").select("id, name, account_type").order("name").limit(1000);
      if (error) {
        throw new Error(`Could not load accounts: ${error.message}`);
      }
      return data.map((row) => ({ id: row.id, name: row.name, accountTypes: row.account_type }));
    },

    async create(input: AccountInput): Promise<WriteResult> {
      const { data, error } = await db
        .from("account")
        .insert(toAccountRow(input))
        .select("id")
        .single();
      return error ? { ok: false, error } : { ok: true, id: data.id };
    },

    async update(id: string, input: AccountInput): Promise<WriteResult> {
      const { data, error } = await db
        .from("account")
        .update(toAccountRow(input))
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

export type AccountRepository = ReturnType<typeof createAccountRepository>;
