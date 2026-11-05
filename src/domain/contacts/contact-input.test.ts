import { describe, expect, it } from "vitest";

import { parseContactInput } from "./contact-input";

const ACCOUNT_ID = "6f1d1c52-5b8e-4b8a-9a3e-2f8c4d0e7a10";

describe("parseContactInput", () => {
  it("accepts a contact and turns empty fields into null", () => {
    expect(
      parseContactInput({
        accountId: ACCOUNT_ID,
        salutation: "",
        firstName: " Jonas ",
        lastName: "Maes",
        email: "jonas.maes@velora-rental.example",
        phone: "",
      }),
    ).toEqual({
      ok: true,
      value: {
        accountId: ACCOUNT_ID,
        salutation: null,
        firstName: "Jonas",
        lastName: "Maes",
        email: "jonas.maes@velora-rental.example",
        phone: null,
      },
    });
  });

  it("requires an account and a last name", () => {
    expect(parseContactInput({ accountId: "", lastName: " " })).toEqual({
      ok: false,
      fieldErrors: {
        accountId: ["Choose the contact's account."],
        lastName: ["Enter the last name."],
      },
    });
  });

  it("rejects an invalid e-mail address", () => {
    const result = parseContactInput({ accountId: ACCOUNT_ID, lastName: "Maes", email: "jonas@" });
    expect(!result.ok && result.fieldErrors.email).toEqual(["Enter a valid e-mail address."]);
  });
});
