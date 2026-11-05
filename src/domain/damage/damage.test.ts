import { describe, expect, it, vi } from "vitest";

import { parseDamageInput } from "./damage-input";
import type { DamageRepository } from "./damage-repository";
import { createDamageService } from "./damage-service";

const CASE = "33333333-3333-4333-8333-333333333333";
const DAMAGE = "99999999-9999-4999-8999-999999999999";

describe("parseDamageInput (UC-12)", () => {
  it("accepts damage details and a parts checklist", () => {
    const result = parseDamageInput({
      damageDate: "2026-11-02",
      mileageIn: "41.250",
      mileageOut: "41262",
      cause: " Rear-end collision ",
      liability: "third_party_fault",
      parts: ["rear_bumper", "boot", "rear_bumper"],
    });
    expect(result.ok && result.value).toMatchObject({
      damageDate: "2026-11-02",
      mileageIn: 41250,
      mileageOut: 41262,
      cause: "Rear-end collision",
      liability: "third_party_fault",
      circumstances: null,
      parts: ["rear_bumper", "boot"],
    });
  });

  it("rejects a mileage out below the mileage in", () => {
    expect(parseDamageInput({ mileageIn: "5000", mileageOut: "4000" })).toEqual({
      ok: false,
      fieldErrors: { mileageOut: ["Mileage out cannot be lower than mileage in."] },
    });
  });

  it("rejects malformed values", () => {
    const result = parseDamageInput({ damageDate: "yesterday", mileageIn: "12.5km", parts: ["Front bumper"] });
    expect(!result.ok && Object.keys(result.fieldErrors).sort()).toEqual(["damageDate", "mileageIn", "parts"]);
  });
});

describe("damage service", () => {
  it("saves the damage and only adds and removes the changed parts", async () => {
    const repository: DamageRepository = {
      getForCase: vi.fn(async () => ({ id: DAMAGE, parts: ["rear_bumper", "boot"] }) as never),
      save: vi.fn(async () => ({ ok: true as const, id: DAMAGE })),
      setParts: vi.fn(async () => ({ ok: true as const, id: DAMAGE })),
    };
    await createDamageService(repository).save(CASE, { parts: ["boot", "roof"] });
    expect(repository.save).toHaveBeenCalledWith(CASE, expect.not.objectContaining({ parts: expect.anything() }));
    expect(repository.setParts).toHaveBeenCalledWith(DAMAGE, ["rear_bumper", "boot"], ["boot", "roof"]);
  });
});
