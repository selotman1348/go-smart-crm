import { getEventDispatcher, isAuthorizedDispatch } from "@/domain/events";

/**
 * Delivers undelivered events to EVENT_WEBHOOK_URL (plan.md section 3).
 * Called by Vercel Cron (vercel.json) with "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: Request) {
  if (!isAuthorizedDispatch(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dispatcher = getEventDispatcher();
  if (!dispatcher) {
    return Response.json({ delivered: 0, skipped: "No event webhook is configured." });
  }
  return Response.json(await dispatcher.dispatch());
}
