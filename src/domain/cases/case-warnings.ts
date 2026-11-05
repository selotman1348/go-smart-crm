export type CaseTab =
  | "case"
  | "vehicle"
  | "parties"
  | "damage"
  | "quote"
  | "assessment"
  | "documents"
  | "history";

export type CaseWarning = { tab: CaseTab; message: string };

/**
 * Warning markers for tabs with missing required information (BR-13).
 * Version 1 so far checks BR-11; the completeness rules engine follows in
 * iteration 5.
 */
export function caseWarnings(input: {
  clientRequiresVdaPo: boolean;
  vdaNumber: string | null;
  poNumber: string | null;
}): CaseWarning[] {
  const warnings: CaseWarning[] = [];
  if (input.clientRequiresVdaPo) {
    const missing = [
      input.vdaNumber ? null : "VDA number",
      input.poNumber ? null : "PO number",
    ].filter(Boolean);
    if (missing.length > 0) {
      warnings.push({
        tab: "case",
        message: `This client requires a VDA and a PO number (BR-11). Missing: ${missing.join(" and ")}.`,
      });
    }
  }
  return warnings;
}

export function warningsForTab(warnings: CaseWarning[], tab: CaseTab): CaseWarning[] {
  return warnings.filter((warning) => warning.tab === tab);
}
