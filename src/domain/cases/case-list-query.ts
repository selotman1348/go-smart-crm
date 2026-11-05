import { z } from "zod";

import { isCaseStatus } from "./status-engine";
import type { CaseStatus } from "./case-status";

/** "Open" in the status filter: every status except Closed (UC-04). */
export const OPEN_STATUS_FILTER = "open";

export type CaseListQuery = {
  search?: string;
  status?: CaseStatus | typeof OPEN_STATUS_FILTER;
  clientId?: string;
  repairerId?: string;
  assignmentFrom?: string;
  assignmentTo?: string;
  damageFrom?: string;
  damageTo?: string;
  completionFrom?: string;
  completionTo?: string;
  createdFrom?: string;
  createdTo?: string;
  page: number;
};

export const CASE_DATE_FILTERS = [
  { key: "assignment", label: "Assignment date" },
  { key: "damage", label: "Damage date" },
  { key: "completion", label: "Completion date" },
  { key: "created", label: "Creation date" },
] as const;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim();
const uuidOrUndefined = (value: string | undefined) => (z.uuid().safeParse(value).success ? value : undefined);
const dateOrUndefined = (value: string | undefined) => (z.iso.date().safeParse(value).success ? value : undefined);

/**
 * Reads the case-list filters from the URL (UC-05, UC-06). Invalid values are
 * ignored rather than failing the page.
 */
export function parseCaseListQuery(params: SearchParams): CaseListQuery {
  const status = first(params.status);
  const page = Number(first(params.page));
  return {
    search: first(params.q) || undefined,
    status: status === OPEN_STATUS_FILTER || isCaseStatus(status) ? status : undefined,
    clientId: uuidOrUndefined(first(params.client)),
    repairerId: uuidOrUndefined(first(params.repairer)),
    assignmentFrom: dateOrUndefined(first(params.assignmentFrom)),
    assignmentTo: dateOrUndefined(first(params.assignmentTo)),
    damageFrom: dateOrUndefined(first(params.damageFrom)),
    damageTo: dateOrUndefined(first(params.damageTo)),
    completionFrom: dateOrUndefined(first(params.completionFrom)),
    completionTo: dateOrUndefined(first(params.completionTo)),
    createdFrom: dateOrUndefined(first(params.createdFrom)),
    createdTo: dateOrUndefined(first(params.createdTo)),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** The query as URL parameters (for paging links), without the page. */
export function caseListParams(query: CaseListQuery): Record<string, string | undefined> {
  return {
    q: query.search,
    status: query.status,
    client: query.clientId,
    repairer: query.repairerId,
    assignmentFrom: query.assignmentFrom,
    assignmentTo: query.assignmentTo,
    damageFrom: query.damageFrom,
    damageTo: query.damageTo,
    completionFrom: query.completionFrom,
    completionTo: query.completionTo,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
  };
}

export function hasDateFilter(query: CaseListQuery): boolean {
  return CASE_DATE_FILTERS.some(
    ({ key }) => query[`${key}From`] !== undefined || query[`${key}To`] !== undefined,
  );
}

/** Licence plates compared without spaces, dashes or case: "9-tka 101" -> "9TKA101". */
export function plateKey(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
