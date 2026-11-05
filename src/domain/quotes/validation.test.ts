import { describe, expect, it } from "vitest";

import type { Quote } from "./quote-rules";
import { amountInclVat, expertAssessmentType, planValidation } from "./validation";

const post: Quote = {
  id: "q-post",
  version: "post_calculation",
  origin: "repairer",
  status: "draft",
  hourlyRatePaint: null,
  hourlyRateAssembly: null,
  total: 1291.85,
  copiedFromQuoteId: "q-pre",
  lines: [{ id: "l1", category: "parts", subType: null, description: "Bumper", amount: 1291.85 }],
};

const approval = {
  assessmentType: "approval_without_expert",
  vatApplicable: "on",
  approvedAmountExclVat: "1291,85",
  lossOfUseDays: "3",
};

describe("VAT and BR-04 helpers", () => {
  it("adds 21% VAT when it applies", () => {
    expect(amountInclVat(1291.85, true)).toBe(1563.14);
    expect(amountInclVat(1291.85, false)).toBe(1291.85);
    expect(amountInclVat(0.01, true)).toBe(0.01);
  });

  it("maps a remote expert assessment to Smart Expertise, otherwise On site", () => {
    expect(expertAssessmentType(true)).toBe("smart_expertise");
    expect(expertAssessmentType(false)).toBe("on_site");
  });
});

describe("planValidation (UC-22)", () => {
  it("validates an approval without expert and plans the automatic status change (BR-03)", () => {
    expect(
      planValidation({ post, hasExpertReport: false, currentStatus: "followup_broker_insurer", input: approval }),
    ).toEqual({
      ok: true,
      quoteId: "q-post",
      assessmentType: "approval_without_expert",
      vatApplicable: true,
      approvedAmountExclVat: 1291.85,
      approvedAmountInclVat: 1563.14,
      lossOfUseDays: 3,
      statusChangeFrom: "followup_broker_insurer",
    });
  });

  it("skips the status change when the case already has the validated status", () => {
    const plan = planValidation({
      post,
      hasExpertReport: false,
      currentStatus: "followup_repairer_report_ok",
      input: approval,
    });
    expect(plan.ok && plan.statusChangeFrom).toBeNull();
  });

  it("needs a post-calculation with lines that is not validated yet", () => {
    expect(planValidation({ post: null, hasExpertReport: false, currentStatus: "followup_expert", input: approval }).ok).toBe(false);
    expect(
      planValidation({ post: { ...post, lines: [] }, hasExpertReport: false, currentStatus: "followup_expert", input: approval }).ok,
    ).toBe(false);
    expect(
      planValidation({ post: { ...post, status: "validated" }, hasExpertReport: false, currentStatus: "followup_expert", input: approval }),
    ).toEqual({ ok: false, formError: "The post-calculation is already validated." });
  });

  it("checks the dialog's fields (BR-05: loss-of-use days are whole days)", () => {
    const plan = planValidation({
      post,
      hasExpertReport: false,
      currentStatus: "followup_expert",
      input: { assessmentType: "guess", approvedAmountExclVat: "", lossOfUseDays: "2.5" },
    });
    expect(!plan.ok && Object.keys(plan.fieldErrors ?? {}).sort()).toEqual([
      "approvedAmountExclVat",
      "assessmentType",
      "lossOfUseDays",
    ]);
  });

  describe("with an expert report", () => {
    const expert = (input: object) =>
      planValidation({ post, hasExpertReport: true, currentStatus: "followup_expert", input: { ...approval, ...input } });

    it("requires On site, or Smart Expertise for a remote assessment (BR-04)", () => {
      expect(expert({ assessmentType: "approval_without_expert", reportMatchesCase: "on" })).toMatchObject({
        ok: false,
        fieldErrors: { assessmentType: ["With an expert report the type is On site (BR-04)."] },
      });
      expect(expert({ assessmentType: "on_site", remoteAssessment: "on", reportMatchesCase: "on" })).toMatchObject({
        ok: false,
        fieldErrors: { assessmentType: ["With an expert report the type is Smart Expertise (remote assessment) (BR-04)."] },
      });
      expect(expert({ assessmentType: "smart_expertise", remoteAssessment: "on", reportMatchesCase: "on" }).ok).toBe(true);
      expect(expert({ assessmentType: "on_site", reportMatchesCase: "on" }).ok).toBe(true);
    });

    it("requires confirmation that the report matches the case's damage (BR-06)", () => {
      expect(expert({ assessmentType: "on_site" })).toEqual({
        ok: false,
        fieldErrors: { reportMatchesCase: ["Confirm that the expert report matches this case's damage (BR-06)."] },
      });
    });
  });
});
