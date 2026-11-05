import { CLIENT_CODE_PATTERN } from "@/domain/accounts/account-input";

/** BR-01: client code + 4-digit year + 4-digit sequence per client per year. */
export const CASE_NUMBER_PATTERN = /^([A-Z]{3,4})(\d{4})(\d{4})$/;

export const MAX_CASE_SEQUENCE = 9999;

export function formatCaseNumber(clientCode: string, year: number, sequence: number): string {
  if (!CLIENT_CODE_PATTERN.test(clientCode)) {
    throw new Error(`Invalid client code "${clientCode}": use 3 or 4 capital letters.`);
  }
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid year ${year}: use 4 digits.`);
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_CASE_SEQUENCE) {
    throw new Error(`Invalid sequence ${sequence}: use 1 to ${MAX_CASE_SEQUENCE}.`);
  }
  return `${clientCode}${year}${String(sequence).padStart(4, "0")}`;
}

export function parseCaseNumber(
  caseNumber: string,
): { clientCode: string; year: number; sequence: number } | null {
  const match = CASE_NUMBER_PATTERN.exec(caseNumber);
  if (!match) {
    return null;
  }
  const [, clientCode, year, sequence] = match;
  return { clientCode, year: Number(year), sequence: Number(sequence) };
}
