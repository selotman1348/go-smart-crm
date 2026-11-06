import { timingSafeEqual } from "node:crypto";

/**
 * The inbound webhook is called by the e-mail provider, not by a signed-in
 * user. It must send HTTP Basic credentials whose password is the shared
 * secret INBOUND_EMAIL_SECRET (Postmark: https://user:secret@host/api/inbound-email).
 * Without a configured secret every call is refused.
 */
export function isAuthorizedWebhook(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization?.startsWith("Basic ")) {
    return false;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  } catch {
    return false;
  }
  const password = decoded.slice(decoded.indexOf(":") + 1);
  const given = Buffer.from(password);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
