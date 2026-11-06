// BR-10: an inbound e-mail is linked to a case automatically only when its
// subject contains the case number. plan.md 2.1: 2–4 capital letters, a
// 4-digit year and a 4-digit sequence (client codes have 3–4 letters, Q-008).
const CASE_NUMBER_IN_TEXT = /(?<![A-Za-z0-9])[A-Z]{2,4}\d{4}\d{4}(?![A-Za-z0-9])/g;

/** The distinct case numbers in a subject, in order of appearance. */
export function caseNumbersInSubject(subject: string | null | undefined): string[] {
  if (!subject) {
    return [];
  }
  return [...new Set(subject.match(CASE_NUMBER_IN_TEXT) ?? [])];
}

/** A case number as typed by a user: "dem20260001 " -> "DEM20260001", or null. */
export function normalizeCaseNumber(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const number = value.trim().toUpperCase();
  return /^[A-Z]{2,4}\d{8}$/.test(number) ? number : null;
}
