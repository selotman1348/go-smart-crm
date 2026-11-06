import { createHash, randomBytes } from "node:crypto";

/**
 * Scopes an API client can hold (plan.md section 3). There is deliberately no
 * scope for status changes or sending: agents create drafts, a human approves.
 */
export const API_SCOPES = ["cases:read", "drafts:write"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export type ApiClient = { id: string; name: string; scopes: string[] };

/** A new key, shown once; only its hash is stored. */
export function generateApiKey(): string {
  return `gsk_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** The key from "Authorization: Bearer gsk_…", or null. */
export function bearerKey(authorization: string | null): string | null {
  const match = /^Bearer\s+(gsk_[A-Za-z0-9_-]{20,})$/.exec(authorization?.trim() ?? "");
  return match ? match[1] : null;
}

export function hasScope(client: ApiClient, scope: ApiScope): boolean {
  return client.scopes.includes(scope);
}

/** Scopes from "cases:read,drafts:write"; unknown ones are rejected. */
export function parseScopes(text: string): { ok: true; value: ApiScope[] } | { ok: false; error: string } {
  const scopes = text.split(",").map((scope) => scope.trim()).filter(Boolean);
  const unknown = scopes.filter((scope) => !(API_SCOPES as readonly string[]).includes(scope));
  if (scopes.length === 0 || unknown.length > 0) {
    return { ok: false, error: `Use one or more of: ${API_SCOPES.join(", ")}.${unknown.length ? ` Unknown: ${unknown.join(", ")}.` : ""}` };
  }
  return { ok: true, value: [...new Set(scopes)] as ApiScope[] };
}
