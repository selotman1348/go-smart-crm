import { fromEml, fromPostmark, getWebhookIntakeService } from "@/domain/intake";

/**
 * Inbound e-mail webhook (plan.md 2.1, UC-34). The provider posts each
 * e-mail sent or forwarded to the intake address, as its inbound JSON or as a
 * raw message (Content-Type message/rfc822). The e-mail is stored and linked
 * to the case whose number is in the subject (BR-10), or left in the Inbox.
 */
export async function POST(request: Request) {
  const intake = await getWebhookIntakeService(request.headers.get("authorization"));
  if (!intake) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Basic" } });
  }

  const raw = new Uint8Array(await request.arrayBuffer());
  const isRawMessage = (request.headers.get("content-type") ?? "").startsWith("message/rfc822");
  let message;
  try {
    message = isRawMessage ? await fromEml(raw) : fromPostmark(JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    message = null;
  }
  if (!message) {
    return Response.json({ error: "The request is not an e-mail." }, { status: 400 });
  }

  const result = await intake.receive(message, { content: raw, extension: isRawMessage ? "eml" : "json" });
  if (!result.ok) {
    // The provider retries later.
    return Response.json({ error: result.error }, { status: 500 });
  }
  return Response.json({
    id: result.id,
    duplicate: result.duplicate,
    linkedCaseNumbers: result.linkedCaseNumbers,
  });
}
