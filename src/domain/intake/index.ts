import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import { createInboundRepository } from "./inbound-repository";
import { createIntakeService, type IntakeService } from "./intake-service";
import { isAuthorizedWebhook } from "./webhook-auth";

export { fromEml, fromPostmark } from "./inbound-message";
export type { InboundEmailDetail, InboundStatus, InboxRow, InboxView } from "./inbound-repository";
export { INBOX_PAGE_SIZE } from "./inbound-repository";

/** The Inbox, as the signed-in user. */
export async function getIntakeService(): Promise<IntakeService> {
  return createIntakeService(createInboundRepository(await createClient()));
}

/**
 * The inbound webhook (no user session): null unless the request carries the
 * shared secret, then a service working with the service role.
 */
export async function getWebhookIntakeService(authorization: string | null): Promise<IntakeService | null> {
  if (!isAuthorizedWebhook(authorization, process.env.INBOUND_EMAIL_SECRET)) {
    return null;
  }
  return createIntakeService(createInboundRepository(await createServiceClient()));
}
