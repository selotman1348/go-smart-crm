import { describe, expect, it } from "vitest";

import { parseCaseHeaderInput } from "./case-header-input";

const TAG = "6f1d1c52-5b8e-4b8a-9a3e-2f8c4d0e7a10";

describe("parseCaseHeaderInput (UC-09, UC-17, UC-28)", () => {
  it("accepts a header and converts form values", () => {
    const result = parseCaseHeaderInput({
      insurerRef: " ATL-26-1 ",
      vdaNumber: "VDA-1",
      vatLiablePct: "35",
      deductible: "250,50",
      assignmentDate: "2026-11-05",
      appointmentRepairAt: "2026-11-10T08:00",
      tagIds: [TAG, TAG],
      newTag: "",
    });
    expect(result.ok && result.value).toMatchObject({
      insurerRef: "ATL-26-1",
      vdaNumber: "VDA-1",
      brokerRef: null,
      vatLiablePct: 35,
      deductible: 250.5,
      assignmentDate: "2026-11-05",
      // Brussels winter time is UTC+1.
      appointmentRepairAt: "2026-11-10T07:00:00.000Z",
      appointmentEstimateAt: null,
      onHold: false,
      tagIds: [TAG],
      newTag: null,
    });
  });

  it("requires a reason when the case is put on hold (UC-28)", () => {
    expect(parseCaseHeaderInput({ onHold: "on" })).toEqual({
      ok: false,
      fieldErrors: { onHoldReason: ["Choose why the case is on hold."] },
    });
    const result = parseCaseHeaderInput({ onHold: "on", onHoldReason: "awaiting_parts", onHoldReasonText: "Week 47" });
    expect(result.ok && result.value).toMatchObject({
      onHold: true,
      onHoldReason: "awaiting_parts",
      onHoldReasonText: "Week 47",
    });
  });

  it("clears the reason when the case is not on hold", () => {
    const result = parseCaseHeaderInput({ onHoldReason: "awaiting_parts", onHoldReasonText: "old note" });
    expect(result.ok && result.value).toMatchObject({ onHold: false, onHoldReason: null, onHoldReasonText: null });
  });

  it("rejects invalid numbers, dates and appointments", () => {
    const result = parseCaseHeaderInput({
      vatLiablePct: "120",
      deductible: "-5",
      completionDate: "2026-02-30",
      appointmentEstimateAt: "tomorrow",
      managerUserId: "sam",
    });
    expect(!result.ok && Object.keys(result.fieldErrors).sort()).toEqual([
      "appointmentEstimateAt",
      "completionDate",
      "deductible",
      "managerUserId",
      "vatLiablePct",
    ]);
  });
});
