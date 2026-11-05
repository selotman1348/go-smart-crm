import { describe, expect, it } from "vitest";

import { parseAccountInput } from "./account-input";

const repairer = {
  name: " Riverside Body Shop BV ",
  accountTypes: ["repairer"],
  discountPct: "13",
  invoicingConditions: "Invoice with 13% discount.",
  isNetworkMember: "on",
};

describe("parseAccountInput", () => {
  it("accepts a repairer and converts form values", () => {
    const result = parseAccountInput({ ...repairer, email: " info@riverside.example ", vatLiable: "on" });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        name: "Riverside Body Shop BV",
        accountTypes: ["repairer"],
        clientCode: null,
        discountPct: 13,
        isNetworkMember: true,
        vatLiable: true,
        requiresVdaPo: false,
        email: "info@riverside.example",
        city: null,
      }),
    });
  });

  it("accepts a decimal comma in the discount", () => {
    const result = parseAccountInput({ ...repairer, discountPct: "12,5" });
    expect(result.ok && result.value.discountPct).toBe(12.5);
  });

  it("requires a name and at least one account type", () => {
    expect(parseAccountInput({ name: "  ", accountTypes: [] })).toEqual({
      ok: false,
      fieldErrors: {
        name: ["Enter the account name."],
        accountTypes: ["Choose at least one account type."],
      },
    });
  });

  it("rejects an unknown account type", () => {
    const result = parseAccountInput({ name: "X", accountTypes: ["garage"] });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.accountTypes).toBeTruthy();
  });

  describe("client code (BR-01)", () => {
    it("is required for a client", () => {
      expect(parseAccountInput({ name: "Velora Car Rental NV", accountTypes: ["client"] })).toEqual({
        ok: false,
        fieldErrors: { clientCode: ["A client needs a client code; it starts every case number."] },
      });
    });

    it("is upper-cased and must be 3 or 4 letters", () => {
      const accepted = parseAccountInput({ name: "Velora", accountTypes: ["client"], clientCode: " vcr " });
      expect(accepted.ok && accepted.value.clientCode).toBe("VCR");

      for (const clientCode of ["VC", "VCRAB", "VC1", "V-CR"]) {
        const rejected = parseAccountInput({ name: "Velora", accountTypes: ["client"], clientCode });
        expect(!rejected.ok && rejected.fieldErrors.clientCode).toEqual([
          "Use 3 or 4 capital letters, for example ABC.",
        ]);
      }
    });

    it("is not allowed on other account types", () => {
      expect(parseAccountInput({ ...repairer, clientCode: "RBS" })).toEqual({
        ok: false,
        fieldErrors: { clientCode: ["Only clients have a client code."] },
      });
    });
  });

  it("keeps the discount between 0 and 100 (BR-09)", () => {
    for (const discountPct of ["-1", "100.5", "abc"]) {
      const result = parseAccountInput({ ...repairer, discountPct });
      expect(!result.ok && result.fieldErrors.discountPct).toEqual(["Enter a number from 0 to 100."]);
    }
  });

  it("rejects an invalid e-mail address", () => {
    const result = parseAccountInput({ ...repairer, email: "info.riverside" });
    expect(!result.ok && result.fieldErrors.email).toEqual(["Enter a valid e-mail address."]);
  });

  it("clears settings that do not apply to the chosen types", () => {
    const result = parseAccountInput({
      name: "Atlas Mutual Insurance NV",
      accountTypes: ["insurer"],
      discountPct: "13",
      invoicingConditions: "n/a",
      isNetworkMember: "on",
      requiresVdaPo: "on",
    });
    expect(result.ok && result.value).toMatchObject({
      discountPct: null,
      invoicingConditions: null,
      isNetworkMember: false,
      requiresVdaPo: false,
    });
  });

  it("keeps VDA/PO for a client (BR-11) and removes duplicate types", () => {
    const result = parseAccountInput({
      name: "Velora Car Rental NV",
      accountTypes: ["client", "client"],
      clientCode: "VCR",
      requiresVdaPo: "on",
    });
    expect(result.ok && result.value).toMatchObject({ accountTypes: ["client"], requiresVdaPo: true });
  });

  it("does not let an account be its own parent", () => {
    const id = "6f1d1c52-5b8e-4b8a-9a3e-2f8c4d0e7a10";
    expect(parseAccountInput({ ...repairer, parentAccountId: id }, { accountId: id })).toEqual({
      ok: false,
      fieldErrors: { parentAccountId: ["An account cannot be its own parent."] },
    });
  });

  it("rejects a parent that is not an id", () => {
    const result = parseAccountInput({ ...repairer, parentAccountId: "velora" });
    expect(!result.ok && result.fieldErrors.parentAccountId).toEqual(["Choose a valid option."]);
  });
});
