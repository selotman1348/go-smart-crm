import { describe, expect, it } from "vitest";

import { caseWarnings, warningsForTab } from "./case-warnings";

describe("caseWarnings (BR-11, BR-13)", () => {
  it("warns on the Case tab when a client that needs them lacks VDA or PO numbers", () => {
    expect(caseWarnings({ clientRequiresVdaPo: true, vdaNumber: null, poNumber: null })).toEqual([
      {
        tab: "case",
        message: "This client requires a VDA and a PO number (BR-11). Missing: VDA number and PO number.",
      },
    ]);
    expect(caseWarnings({ clientRequiresVdaPo: true, vdaNumber: "VDA-1", poNumber: null })[0].message).toMatch(
      /Missing: PO number\.$/,
    );
  });

  it("does not warn when both references are present or the client does not need them", () => {
    expect(caseWarnings({ clientRequiresVdaPo: true, vdaNumber: "VDA-1", poNumber: "PO-1" })).toEqual([]);
    expect(caseWarnings({ clientRequiresVdaPo: false, vdaNumber: null, poNumber: null })).toEqual([]);
  });

  it("filters warnings per tab", () => {
    const warnings = caseWarnings({ clientRequiresVdaPo: true, vdaNumber: null, poNumber: null });
    expect(warningsForTab(warnings, "case")).toHaveLength(1);
    expect(warningsForTab(warnings, "vehicle")).toHaveLength(0);
  });
});
