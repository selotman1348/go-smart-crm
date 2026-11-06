import { z } from "zod";

import { isCaseStatus } from "@/domain/cases/status-engine";
import { parseAddressList } from "@/domain/communications/communication-input";
import { TEMPLATE_LANGUAGES } from "@/domain/communications/templates";
import { normalizeCaseNumber } from "@/domain/intake/case-number-match";
import { isUuid } from "@/domain/shared/input";

import { bearerKey, hashApiKey, hasScope, type ApiClient, type ApiScope } from "./api-keys";
import type { ApiRepository } from "./api-repository";

/** An HTTP answer: status code and JSON body (docs/api.md). */
export type ApiResult = { status: number; body: unknown };

const error = (status: number, message: string): ApiResult => ({ status, body: { error: message } });

const draftSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]).optional(),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  subject: z.string().trim().min(1, { error: "subject is required." }).max(300),
  body: z.string().trim().min(1, { error: "body is required." }).max(50_000),
  templateCode: z.string().max(100).optional(),
  language: z.enum(TEMPLATE_LANGUAGES).optional(),
});

const intakeSchema = z.object({
  proposedFields: z.record(z.string(), z.json()),
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  missingFields: z.array(z.string().max(100)).max(100).default([]),
});

function addresses(value: string | string[] | undefined): { ok: true; value: string[] } | { ok: false; error: string } {
  return parseAddressList(Array.isArray(value) ? value.join(",") : (value ?? ""));
}

/**
 * The external API for agents (plan.md section 3). It reads cases and creates
 * drafts; final status changes and sending are not part of it, whatever the
 * scopes.
 */
export function createApiService(repository: ApiRepository) {
  async function authorize(authorization: string | null, scope: ApiScope): Promise<ApiClient | ApiResult> {
    const key = bearerKey(authorization);
    const client = key ? await repository.clientByKeyHash(hashApiKey(key)) : null;
    if (!client) {
      return error(401, "A valid API key is required (Authorization: Bearer gsk_…).");
    }
    if (!hasScope(client, scope)) {
      return error(403, `This API key lacks the scope ${scope}.`);
    }
    return client;
  }

  const isResult = (value: ApiClient | ApiResult): value is ApiResult => "status" in value;

  return {
    /** GET /api/v1/cases */
    async listCases(authorization: string | null, query: URLSearchParams): Promise<ApiResult> {
      const client = await authorize(authorization, "cases:read");
      if (isResult(client)) {
        return client;
      }
      const status = query.get("status");
      if (status !== null && !isCaseStatus(status)) {
        return error(400, "Unknown status.");
      }
      const limit = Math.min(100, Math.max(1, Number.parseInt(query.get("limit") ?? "50", 10) || 50));
      return { status: 200, body: { cases: await repository.listCases({ status: status ?? null, limit }) } };
    },

    /** GET /api/v1/cases/{caseNumber} */
    async getCase(authorization: string | null, caseNumberInput: string): Promise<ApiResult> {
      const client = await authorize(authorization, "cases:read");
      if (isResult(client)) {
        return client;
      }
      const caseNumber = normalizeCaseNumber(caseNumberInput);
      const found = caseNumber ? await repository.caseByNumber(caseNumber) : null;
      if (!found) {
        return error(404, "No such case.");
      }
      // The internal id stays internal; agents address cases by number.
      return {
        status: 200,
        body: {
          case: {
            caseNumber: found.caseNumber,
            status: found.status,
            client: found.client,
            licencePlate: found.licencePlate,
            createdAt: found.createdAt,
            insurerRef: found.insurerRef,
            brokerRef: found.brokerRef,
            policyNumber: found.policyNumber,
            parties: found.parties,
          },
        },
      };
    },

    /** POST /api/v1/cases/{caseNumber}/email-drafts – a draft a user reviews and sends. */
    async createEmailDraft(authorization: string | null, caseNumberInput: string, payload: unknown): Promise<ApiResult> {
      const client = await authorize(authorization, "drafts:write");
      if (isResult(client)) {
        return client;
      }
      const caseNumber = normalizeCaseNumber(caseNumberInput);
      const found = caseNumber ? await repository.caseByNumber(caseNumber) : null;
      if (!found) {
        return error(404, "No such case.");
      }
      const parsed = draftSchema.safeParse(payload);
      if (!parsed.success) {
        return error(400, parsed.error.issues.map((issue) => issue.message).join(" "));
      }
      const to = addresses(parsed.data.to);
      const cc = addresses(parsed.data.cc);
      if (!to.ok || !cc.ok) {
        return error(400, (!to.ok ? to.error : null) ?? (!cc.ok ? cc.error : ""));
      }
      const templateId = parsed.data.templateCode
        ? await repository.templateId(parsed.data.templateCode, parsed.data.language ?? "en")
        : null;
      if (parsed.data.templateCode && !templateId) {
        return error(400, "Unknown template or language.");
      }
      const result = await repository.createOutboundDraft(client.id, {
        caseId: found.id,
        templateId,
        to: to.value,
        cc: cc.value,
        subject: parsed.data.subject,
        body: parsed.data.body,
      });
      if (!result.ok) {
        return error(500, "The draft could not be saved.");
      }
      return { status: 201, body: { id: result.id, status: "draft" } };
    },

    /** POST /api/v1/inbound-emails/{id}/intake-draft – proposed case data for an e-mail in the Inbox. */
    async proposeIntake(authorization: string | null, emailId: string, payload: unknown): Promise<ApiResult> {
      const client = await authorize(authorization, "drafts:write");
      if (isResult(client)) {
        return client;
      }
      if (!isUuid(emailId)) {
        return error(404, "No such e-mail.");
      }
      const parsed = intakeSchema.safeParse(payload);
      if (!parsed.success) {
        return error(400, "Send proposedFields (object), fieldConfidence (0–1 per field) and missingFields (list).");
      }
      const result = await repository.proposeIntake(client.id, emailId, parsed.data);
      if (!result.ok) {
        return result.error.code === "PT409" ? error(409, "The e-mail is not waiting for triage.") : error(500, "The draft could not be saved.");
      }
      return { status: 201, body: { id: result.id, status: "in_review" } };
    },
  };
}

export type ApiService = ReturnType<typeof createApiService>;
