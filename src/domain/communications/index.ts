import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createCommunicationRepository } from "./communication-repository";
import { createCommunicationService, type CommunicationService } from "./communication-service";
import { createPostmarkTransport, createRecordOnlyTransport } from "./email-transport";

export type { CommunicationItem, OutboundMessage, TemplateSummary } from "./communication-repository";
export type { ComposeView } from "./communication-service";

/**
 * Postmark delivers when POSTMARK_SERVER_TOKEN is set; otherwise e-mails are
 * recorded on the case without being delivered (development, tests).
 */
export async function getCommunicationService(): Promise<CommunicationService> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  return createCommunicationService({
    repository: createCommunicationRepository(await createClient()),
    transport: token ? createPostmarkTransport(token) : createRecordOnlyTransport(),
    settings: {
      from: process.env.EMAIL_FROM || "Go Smart CRM <cases@gosmart.example>",
      companyName: process.env.COMPANY_NAME || "Go Smart",
      invoicingEmail: process.env.INVOICING_EMAIL || null,
    },
  });
}
