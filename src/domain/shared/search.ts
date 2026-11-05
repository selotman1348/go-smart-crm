export const PAGE_SIZE = 25;

/** Splits a free-text search into terms; every term must match (AND). */
export function searchTerms(query: string | null | undefined): string[] {
  return (query ?? "")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 5);
}

/**
 * Builds a PostgREST `or` filter that matches `term` (case-insensitive, as a
 * substring) in any of `columns`. The term is escaped for LIKE (`%`, `_`, `\`)
 * and quoted for PostgREST, so user input cannot change the filter.
 */
export function ilikeAnyFilter(columns: string[], term: string): string {
  const likePattern = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const quoted = `"${likePattern.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}

/** Page number from a query-string value: a positive integer, default 1. */
export function pageNumber(value: unknown): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function pageRange(page: number, pageSize = PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export type Page<Item> = {
  items: Item[];
  total: number;
  page: number;
  pageCount: number;
};
