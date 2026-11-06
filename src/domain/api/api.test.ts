import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createEventDispatcher, signBody, type PendingEvent } from "@/domain/events/event-dispatcher";

import { bearerKey, generateApiKey, hashApiKey, parseScopes } from "./api-keys";
import type { ApiRepository } from "./api-repository";
import { createApiService } from "./api-service";

const CLIENT_ID = "12121212-1212-4212-8212-121212121212";
const CASE_ID = "33333333-3333-4333-8333-333333333333";

describe("API keys (plan.md section 3)", () => {
  it("generates keys that are stored only as a hash", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^gsk_[A-Za-z0-9_-]{43}$/);
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).not.toContain(key);
    expect(bearerKey(`Bearer ${key}`)).toBe(key);
    expect(bearerKey(key)).toBeNull();
    expect(bearerKey("Bearer short")).toBeNull();
  });

  it("knows only read and draft scopes", () => {
    expect(parseScopes("cases:read, drafts:write")).toEqual({ ok: true, value: ["cases:read", "drafts:write"] });
    expect(parseScopes("cases:read,status:write")).toEqual({
      ok: false,
      error: "Use one or more of: cases:read, drafts:write. Unknown: status:write.",
    });
  });
});

describe("the external API", () => {
  const readKey = generateApiKey();
  const draftKey = generateApiKey();

  function setup() {
    const drafts: unknown[] = [];
    const repository = {
      clientByKeyHash: async (hash: string) =>
        hash === hashApiKey(readKey)
          ? { id: CLIENT_ID, name: "Reader", scopes: ["cases:read"] }
          : hash === hashApiKey(draftKey)
            ? { id: CLIENT_ID, name: "Intake agent", scopes: ["cases:read", "drafts:write"] }
            : null,
      listCases: async () => [],
      caseByNumber: async (number: string) =>
        number === "DEM20260001"
          ? {
              id: CASE_ID,
              caseNumber: "DEM20260001",
              status: "client_assignment",
              client: "Demo Fleet BV",
              licencePlate: "2-DMO-001",
              createdAt: "2026-11-09T09:00:00Z",
              insurerRef: null,
              brokerRef: null,
              policyNumber: null,
              parties: [],
            }
          : null,
      templateId: async () => null,
      createOutboundDraft: async (_client: string, draft: unknown) => {
        drafts.push(draft);
        return { ok: true as const, id: "d1" };
      },
      proposeIntake: async () => ({ ok: false as const, error: { code: "PT409", message: "x" } }),
    } as unknown as ApiRepository;
    return { api: createApiService(repository), drafts };
  }

  it("needs a valid key, and the scope for the call", async () => {
    const { api } = setup();
    expect((await api.getCase(null, "DEM20260001")).status).toBe(401);
    expect((await api.getCase("Bearer gsk_unknownunknownunknownunknown", "DEM20260001")).status).toBe(401);
    const found = await api.getCase(`Bearer ${readKey}`, "dem20260001");
    expect(found.status).toBe(200);
    expect(JSON.stringify(found.body)).not.toContain(CASE_ID);
    expect(await api.createEmailDraft(`Bearer ${readKey}`, "DEM20260001", { subject: "s", body: "b" })).toEqual({
      status: 403,
      body: { error: "This API key lacks the scope drafts:write." },
    });
  });

  it("creates drafts only, never sends", async () => {
    const { api, drafts } = setup();
    const created = await api.createEmailDraft(`Bearer ${draftKey}`, "DEM20260001", {
      to: ["claims@harbourline.example"],
      subject: "Missing data",
      body: "Please send the policy number.",
    });
    expect(created).toEqual({ status: 201, body: { id: "d1", status: "draft" } });
    expect(drafts[0]).toMatchObject({ caseId: CASE_ID, to: ["claims@harbourline.example"], subject: "Missing data" });
    expect((await api.createEmailDraft(`Bearer ${draftKey}`, "DEM20260001", { to: "nope", subject: "s", body: "b" })).status).toBe(400);
    expect((await api.createEmailDraft(`Bearer ${draftKey}`, "ZZZ20269999", { subject: "s", body: "b" })).status).toBe(404);
    expect(
      (await api.proposeIntake(`Bearer ${draftKey}`, "44444444-4444-4444-8444-444444444444", { proposedFields: { plate: "1-ABC-123" } })).status,
    ).toBe(409);
  });
});

describe("event webhooks", () => {
  const events: PendingEvent[] = [
    { id: "e1", type: "case.created", caseId: CASE_ID, payload: { caseNumber: "DEM20260001" }, createdAt: "2026-11-09T09:00:00Z" },
    { id: "e2", type: "status.changed", caseId: CASE_ID, payload: {}, createdAt: "2026-11-09T09:05:00Z" },
  ];

  it("signs each event and marks it delivered after a 2xx", async () => {
    const delivered: string[] = [];
    const requests: RequestInit[] = [];
    const dispatcher = createEventDispatcher({
      repository: { undelivered: async () => events, markDelivered: async (id) => void delivered.push(id) },
      url: "https://hooks.example/gosmart",
      secret: "webhook-secret",
      fetch: (async (_url: string, init: RequestInit) => {
        requests.push(init);
        return new Response(null, { status: 204 });
      }) as unknown as typeof fetch,
    });
    expect(await dispatcher.dispatch()).toEqual({ delivered: 2, failed: null });
    expect(delivered).toEqual(["e1", "e2"]);
    const headers = requests[0].headers as Record<string, string>;
    const expected = `sha256=${createHmac("sha256", "webhook-secret").update(requests[0].body as string).digest("hex")}`;
    expect(headers["X-GoSmart-Signature"]).toBe(expected);
    expect(signBody(requests[0].body as string, "webhook-secret")).toBe(expected);
    expect(headers["X-GoSmart-Event"]).toBe("case.created");
  });

  it("stops at the first failure so the order is kept", async () => {
    const delivered: string[] = [];
    const dispatcher = createEventDispatcher({
      repository: { undelivered: async () => events, markDelivered: async (id) => void delivered.push(id) },
      url: "https://hooks.example/gosmart",
      secret: "s",
      fetch: (async () => new Response(null, { status: 500 })) as unknown as typeof fetch,
    });
    expect(await dispatcher.dispatch()).toEqual({ delivered: 0, failed: "e1" });
    expect(delivered).toEqual([]);
  });
});
