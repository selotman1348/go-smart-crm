import { createHmac } from "node:crypto";

import type { Json } from "@/lib/supabase/database.types";

export type PendingEvent = { id: string; type: string; caseId: string | null; payload: Json; createdAt: string };

export type EventRepository = {
  undelivered(limit: number): Promise<PendingEvent[]>;
  markDelivered(id: string): Promise<void>;
};

/** "sha256=<hex>" over the raw request body, with the shared webhook secret. */
export function signBody(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

/**
 * Outbound event webhooks (plan.md section 3): posts undelivered events,
 * oldest first, to the subscriber and marks each one delivered after a 2xx
 * answer. It stops at the first failure, so events keep their order; the
 * next run retries.
 */
export function createEventDispatcher(deps: {
  repository: EventRepository;
  url: string;
  secret: string;
  fetch?: typeof fetch;
}) {
  const fetchImpl = deps.fetch ?? fetch;
  return {
    async dispatch(limit = 50): Promise<{ delivered: number; failed: string | null }> {
      let delivered = 0;
      for (const event of await deps.repository.undelivered(limit)) {
        const body = JSON.stringify({
          id: event.id,
          type: event.type,
          caseId: event.caseId,
          payload: event.payload,
          createdAt: event.createdAt,
        });
        let response: Response;
        try {
          response = await fetchImpl(deps.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-GoSmart-Event": event.type,
              "X-GoSmart-Delivery": event.id,
              "X-GoSmart-Signature": signBody(body, deps.secret),
            },
            body,
          });
        } catch {
          return { delivered, failed: event.id };
        }
        if (!response.ok) {
          return { delivered, failed: event.id };
        }
        await deps.repository.markDelivered(event.id);
        delivered += 1;
      }
      return { delivered, failed: null };
    },
  };
}
