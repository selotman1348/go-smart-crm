export type CaseTab =
  | "case"
  | "vehicle"
  | "parties"
  | "damage"
  | "quote"
  | "assessment"
  | "communications"
  | "documents"
  | "history";

export type CaseWarning = { tab: CaseTab; message: string };

/**
 * Warning markers for tabs with missing required information (BR-13): BR-11
 * here; the invoicing requirements (BR-08) come from the completeness rules
 * (src/domain/invoicing/completeness.ts) and are added by the case service.
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
