import type { DbClient } from "@/lib/supabase/server";

import type { CaseStatus } from "@/domain/cases/case-status";
import type { RepositoryError } from "@/domain/shared/repository";

import type { CompletenessFacts, CompletenessRule } from "./completeness";

export type RepairerInvoice = {
  received: boolean;
  receivedDate: string | null;
  invoiceNumber: string | null;
  amountExclVat: number | null;
  documentId: string | null;
};

export type SalesInvoice = { invoiceNumber: string | null; amountExclVat: number | null; recordedAt: string };

export type InvoicingData = {
  caseId: string;
  clientAccountId: string;
  status: CaseStatus;
  facts: CompletenessFacts;
  repairerInvoice: RepairerInvoice | null;
  salesInvoice: SalesInvoice | null;
  approvedExclVat: number | null;
  repairerDiscountPct: number | null;
  invoiceDocuments: { id: string; fileName: string }[];
};

export function createInvoiceRepository(db: DbClient) {
  return {
    async rules(): Promise<CompletenessRule[]> {
      const { data, error } = await db
        .from("completeness_rule")
        .select("client_account_id, stage, requirement")
        .eq("active", true)
        .order("created_at");
      if (error) {
        throw new Error(`Could not load the completeness rules: ${error.message}`);
      }
      return data.map((row) => ({ clientAccountId: row.client_account_id, stage: row.stage, requirement: row.requirement }));
    },

    /** Everything invoicing and the completeness check (BR-08) look at. */
    async load(caseId: string): Promise<InvoicingData | null> {
      const { data, error } = await db
        .from("case")
        .select(
          `id, client_account_id, status,
           quote (version, quote_line (count)),
           document (id, file_name, category),
           assessment (validated_at, approved_amount_excl_vat),
           invoice (direction, received, received_date, invoice_number, amount_excl_vat, document_id, created_at),
           case_party (role, account:account!case_party_account_id_fkey (discount_pct))`,
        )
        .eq("id", caseId)
        .maybeSingle();
      if (error) {
        throw new Error(`Could not load the case: ${error.message}`);
      }
      if (!data) {
        return null;
      }
      const pre = data.quote.find((quote) => quote.version === "pre_calculation");
      const documents = data.document;
      const purchase = data.invoice.find((invoice) => invoice.direction === "purchase") ?? null;
      const sales = data.invoice.find((invoice) => invoice.direction === "sales") ?? null;
      const repairer = data.case_party.find((party) => party.role === "repairer");
      return {
        caseId: data.id,
        clientAccountId: data.client_account_id,
        status: data.status,
        facts: {
          hasEstimate: (pre?.quote_line[0]?.count ?? 0) > 0 || documents.some((document) => document.category === "estimate"),
          hasApprovalOrExpertReport:
            Boolean(data.assessment?.validated_at) || documents.some((document) => document.category === "expert_report"),
          hasRepairerInvoice: purchase?.received === true,
        },
        repairerInvoice: purchase
          ? {
              received: purchase.received,
              receivedDate: purchase.received_date,
              invoiceNumber: purchase.invoice_number,
              amountExclVat: purchase.amount_excl_vat,
              documentId: purchase.document_id,
            }
          : null,
        salesInvoice: sales
          ? { invoiceNumber: sales.invoice_number, amountExclVat: sales.amount_excl_vat, recordedAt: sales.created_at }
          : null,
        approvedExclVat: data.assessment?.validated_at ? data.assessment.approved_amount_excl_vat : null,
        repairerDiscountPct: repairer?.account?.discount_pct ?? null,
        invoiceDocuments: documents
          .filter((document) => document.category === "invoice")
          .map((document) => ({ id: document.id, fileName: document.file_name })),
      };
    },

    async saveRepairerInvoice(caseId: string, invoice: RepairerInvoice): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.from("invoice").upsert(
        {
          case_id: caseId,
          direction: "purchase",
          received: invoice.received,
          received_date: invoice.receivedDate,
          invoice_number: invoice.invoiceNumber,
          amount_excl_vat: invoice.amountExclVat,
          document_id: invoice.documentId,
        },
        { onConflict: "case_id,direction" },
      );
      return error ? { ok: false, error } : { ok: true };
    },

    async recordSalesInvoice(
      caseId: string,
      invoice: { invoiceNumber: string; amountExclVat: number | null },
      expectedStatus: CaseStatus,
    ): Promise<{ ok: true } | { ok: false; error: RepositoryError }> {
      const { error } = await db.rpc("record_sales_invoice", {
        p_case_id: caseId,
        p_invoice_number: invoice.invoiceNumber,
        p_amount_excl_vat: invoice.amountExclVat as number,
        p_expected_status: expectedStatus,
      });
      return error ? { ok: false, error } : { ok: true };
    },
  };
}

export type InvoiceRepository = ReturnType<typeof createInvoiceRepository>;
