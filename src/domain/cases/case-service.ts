import { isUuid, type SaveResult } from "@/domain/shared/input";
import type { RepositoryError } from "@/domain/shared/repository";
import { zonedDate } from "@/domain/shared/time";

import { parseCaseHeaderInput, type CaseHeaderField } from "./case-header-input";
import type { CaseListQuery } from "./case-list-query";
import { nextCaseNumber } from "./case-number";
import type { CaseRepository } from "./case-repository";
import { caseWarnings } from "./case-warnings";
import { INVOICING_STATUSES, invoicingOkError, type CompletenessItem } from "@/domain/invoicing/completeness";

import { planStatusChange } from "./status-engine";

export const CASE_NUMBER_ATTEMPTS = 5;
export const CASE_CREATE_FAILED_MESSAGE = "The case could not be created. Please try again.";
export const CASE_SAVE_FAILED_MESSAGE = "The case could not be saved. Please try again.";
export const CASE_NOT_FOUND_MESSAGE = "This case no longer exists.";
export const STATUS_CONFLICT_MESSAGE =
  "Someone else changed the status in the meantime. Reload the case and try again.";
export const STATUS_CHANGE_FAILED_MESSAGE = "The status could not be changed. Please try again.";

const isUniqueViolation = (error: RepositoryError | "not_found", constraint: string) =>
  error !== "not_found" && error.code === "23505" && error.message.includes(constraint);

function explainHeaderError(error: RepositoryError | "not_found"): SaveResult<CaseHeaderField> {
  if (error === "not_found") {
    return { ok: false, formError: CASE_NOT_FOUND_MESSAGE };
  }
  // 23503: foreign_key_violation on a lookup or user.
  if (error.code === "23503") {
    if (error.message.includes("on_hold_reason")) {
      return { ok: false, fieldErrors: { onHoldReason: ["Choose a valid reason."] } };
    }
    if (error.message.includes("manager_user_id")) {
      return { ok: false, fieldErrors: { managerUserId: ["Choose an existing user."] } };
    }
    if (error.message.includes("assigned_to_user_id")) {
      return { ok: false, fieldErrors: { assignedToUserId: ["Choose an existing user."] } };
    }
  }
  return { ok: false, formError: CASE_SAVE_FAILED_MESSAGE };
}

/** The invoicing completeness check (BR-08), from src/domain/invoicing. */
export type InvoicingCompleteness = (caseId: string) => Promise<CompletenessItem[]>;

export function createCaseService(
  repository: CaseRepository,
  now: () => Date = () => new Date(),
  invoicingCompleteness: InvoicingCompleteness = async () => [],
) {
  return {
    list(query: CaseListQuery) {
      return repository.list(query);
    },

    clientTiles() {
      return repository.clientTiles();
    },

    listTags() {
      return repository.listTags();
    },

    /** The case with its warning markers (BR-11, and BR-08 while invoicing; BR-13), or null. */
    async get(id: string) {
      if (!isUuid(id)) {
        return null;
      }
      const detail = await repository.getById(id);
      if (!detail) {
        return null;
      }
      const missing = INVOICING_STATUSES.includes(detail.status)
        ? (await invoicingCompleteness(id)).filter((item) => !item.met)
        : [];
      return {
        ...detail,
        warnings: [
          ...caseWarnings({
            clientRequiresVdaPo: detail.client.requiresVdaPo,
            vdaNumber: detail.header.vdaNumber,
            poNumber: detail.header.poNumber,
          }),
          ...missing.map((item) => ({ tab: item.tab, message: `Missing for invoicing (BR-08): ${item.label}.` })),
        ],
      };
    },

    /**
     * UC-08 / UC-16: creates a case for a client with only the data available.
     * The number is client code + year + next sequence (BR-01); if another
     * user takes the same number at the same moment, the next one is tried.
     * Defaults: the creating user manages and handles the case, the
     * assignment date is today and the client is the owner/fleet owner.
     */
    async create(input: { clientAccountId?: unknown }, userId: string): Promise<SaveResult<"clientAccountId">> {
      const clientId = input.clientAccountId;
      const client = isUuid(clientId) ? await repository.getClient(clientId) : null;
      if (!client) {
        return { ok: false, fieldErrors: { clientAccountId: ["Choose a client."] } };
      }

      const today = zonedDate(now());
      const year = Number(today.slice(0, 4));
      for (let attempt = 0; attempt < CASE_NUMBER_ATTEMPTS; attempt++) {
        let caseNumber: string;
        try {
          caseNumber = nextCaseNumber(client.clientCode, year, await repository.lastCaseNumber(client.clientCode, year));
        } catch (error) {
          return { ok: false, formError: error instanceof Error ? error.message : CASE_CREATE_FAILED_MESSAGE };
        }
        const result = await repository.create({
          caseNumber,
          clientAccountId: client.id,
          ownerAccountId: client.id,
          managerUserId: userId,
          assignedToUserId: userId,
          assignmentDate: today,
        });
        if (result.ok) {
          return result;
        }
        if (!isUniqueViolation(result.error, "case_case_number_key")) {
          return { ok: false, formError: CASE_CREATE_FAILED_MESSAGE };
        }
      }
      return { ok: false, formError: CASE_CREATE_FAILED_MESSAGE };
    },

    /** UC-09, UC-17, UC-28: saves the case header, on hold and tags. */
    async saveHeader(caseId: string, input: unknown): Promise<SaveResult<CaseHeaderField>> {
      const parsed = parseCaseHeaderInput(input);
      if (!parsed.ok) {
        return { ok: false, fieldErrors: parsed.fieldErrors };
      }
      const current = isUuid(caseId) ? await repository.getById(caseId) : null;
      if (!current) {
        return { ok: false, formError: CASE_NOT_FOUND_MESSAGE };
      }

      const { tagIds, newTag, ...header } = parsed.value;
      const result = await repository.updateHeader(caseId, header);
      if (!result.ok) {
        return explainHeaderError(result.error);
      }
      const wantedTags = newTag ? [...new Set([...tagIds, await repository.findOrCreateTag(newTag)])] : tagIds;
      await repository.setCaseTags(caseId, current.tagIds, wantedTags);
      return result;
    },

    /** Changes the status through the status engine (design.md section 2). */
    async changeStatus(
      caseId: string,
      target: unknown,
      options: { automatic?: boolean } = {},
    ): Promise<{ ok: true } | { ok: false; error: string }> {
      const current = isUuid(caseId) ? await repository.getStatus(caseId) : null;
      if (!current) {
        return { ok: false, error: CASE_NOT_FOUND_MESSAGE };
      }
      const plan = planStatusChange({
        current,
        target,
        automatic: options.automatic,
        invoicingOkError: target === "invoicing_ok" ? invoicingOkError(await invoicingCompleteness(caseId)) : null,
      });
      if (!plan.ok) {
        return plan;
      }
      const result = await repository.changeStatus(caseId, plan.from, plan.to, plan.automatic);
      if (!result.ok) {
        return {
          ok: false,
          error: result.error.code === "PT409" ? STATUS_CONFLICT_MESSAGE : STATUS_CHANGE_FAILED_MESSAGE,
        };
      }
      return { ok: true };
    },
  };
}

export type CaseService = ReturnType<typeof createCaseService>;
