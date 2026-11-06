import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createInvoiceRepository } from "./invoice-repository";
import { createInvoiceService, type InvoiceService } from "./invoice-service";

export type { CompletenessItem } from "./completeness";

export async function getInvoiceService(): Promise<InvoiceService> {
  return createInvoiceService(createInvoiceRepository(await createClient()));
}
