import { describe, expect, it } from "vitest";

import { planNoRepair, planTotalLoss, proposedTotalLossAmount } from "./repair-decision";

describe("planNoRepair (UC-27, BR-07)", () => {
  it("records the reason and closes the case", () => {
    expect(
      planNoRepair("followup_broker_insurer", { reason: "cash_settlement", reasonText: " Agreed ", repairerNotified: "on" }),
    ).toEqual({
      ok: true,
      values: { reason: "cash_settlement", reasonText: "Agreed" },
      statusChangeFrom: "followup_broker_insurer",
    });
  });

  it("requires a reason and a notified repairer", () => {
    expect(planNoRepair("followup_expert", {})).toEqual({
      ok: false,
      fieldErrors: {
        reason: ["Choose why the repair is cancelled (BR-07)."],
        repairerNotified: ["Confirm that the repairer was told not to start the repair (BR-07)."],
      },
    });
  });

  it("does not close a case twice", () => {
    expect(planNoRepair("closed", { reason: "other", repairerNotified: "on" })).toEqual({
      ok: false,
      formError: "The case is already closed.",
    });
  });
});

describe("total loss (UC-26)", () => {
  it("proposes value − previous damage + accessories − wreck, never below 0", () => {
    expect(
      proposedTotalLossAmount({ vehicleValue: 18500, previousDamageDeduction: 750, accessories: 400, wreckValue: 3200.5 }),
    ).toBe(14949.5);
    expect(proposedTotalLossAmount({ vehicleValue: 9000, previousDamageDeduction: null, accessories: null, wreckValue: null })).toBe(9000);
    expect(proposedTotalLossAmount({ vehicleValue: 1000, previousDamageDeduction: 0, accessories: 0, wreckValue: 1500 })).toBe(0);
  });

  it("uses the proposed amount unless another amount is entered", () => {
    const proposed = planTotalLoss("followup_expert", { vehicleValue: "18.500", wreckValue: "3200,50" });
    expect(proposed.ok && proposed.values.damageAmount).toBe(15299.5);
    const entered = planTotalLoss("followup_expert", { vehicleValue: "18500", wreckValue: "3200", damageAmount: "15000" });
    expect(entered.ok && entered.values.damageAmount).toBe(15000);
    expect(entered.ok && entered.statusChangeFrom).toBe("followup_expert");
  });

  it("requires the vehicle value and positive figures", () => {
    const result = planTotalLoss("followup_expert", { vehicleValue: "", accessories: "-5" });
    expect(!result.ok && Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["accessories", "vehicleValue"]);
  });
});
