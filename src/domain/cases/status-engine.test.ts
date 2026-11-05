import { describe, expect, it } from "vitest";

import { CASE_STATUSES } from "./case-status";
import { planStatusChange } from "./status-engine";

describe("status engine (design.md section 2)", () => {
  it("lets users set any other status manually", () => {
    for (const target of CASE_STATUSES.filter((status) => status !== "client_assignment")) {
      expect(planStatusChange({ current: "client_assignment", target })).toEqual({
        ok: true,
        from: "client_assignment",
        to: target,
        automatic: false,
      });
    }
    // Including going back, e.g. reopening a closed case.
    expect(planStatusChange({ current: "closed", target: "followup_repairer" }).ok).toBe(true);
  });

  it("rejects the status the case already has", () => {
    expect(planStatusChange({ current: "followup_expert", target: "followup_expert" })).toEqual({
      ok: false,
      error: "The case already has this status.",
    });
  });

  it("rejects an unknown status", () => {
    for (const target of [undefined, null, "", "archived", 3]) {
      expect(planStatusChange({ current: "closed", target }).ok).toBe(false);
    }
  });

  it("allows an automatic change only for quote validation (BR-03)", () => {
    expect(
      planStatusChange({ current: "followup_broker_insurer", target: "followup_repairer_report_ok", automatic: true }),
    ).toEqual({ ok: true, from: "followup_broker_insurer", to: "followup_repairer_report_ok", automatic: true });
    expect(planStatusChange({ current: "followup_repairer", target: "closed", automatic: true }).ok).toBe(false);
  });
});
