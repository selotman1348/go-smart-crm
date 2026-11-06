import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { DbClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import { createEventDispatcher, type EventRepository } from "./event-dispatcher";

function createEventRepository(db: DbClient): EventRepository {
  return {
    async undelivered(limit) {
      const { data, error } = await db
        .from("event")
        .select("id, type, case_id, payload, created_at")
        .eq("delivered", false)
        .order("created_at")
        .limit(limit);
      if (error) {
        throw new Error(`Could not load events: ${error.message}`);
      }
      return data.map((row) => ({ id: row.id, type: row.type, caseId: row.case_id, payload: row.payload, createdAt: row.created_at }));
    },
    async markDelivered(id) {
      const { error } = await db.from("event").update({ delivered: true }).eq("id", id);
      if (error) {
        throw new Error(`Could not mark the event delivered: ${error.message}`);
      }
    },
  };
}

/** Whether the request carries "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends it). */
export function isAuthorizedDispatch(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const given = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The dispatcher for EVENT_WEBHOOK_URL, or null when no subscriber is configured. */
export function getEventDispatcher() {
  const url = process.env.EVENT_WEBHOOK_URL;
  const secret = process.env.EVENT_WEBHOOK_SECRET;
  if (!url || !secret) {
    return null;
  }
  return createEventDispatcher({ repository: createEventRepository(createServiceClient()), url, secret });
}
