/** A database error, reduced to what a service needs to explain it. */
export type RepositoryError = { code?: string; message: string };

export type WriteResult =
  | { ok: true; id: string }
  | { ok: false; error: RepositoryError | "not_found" };
