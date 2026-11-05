import { describe, expect, it } from "vitest";

import { parseLoginInput } from "./login-input";

describe("parseLoginInput", () => {
  it("accepts an e-mail address and password, trimming the e-mail address", () => {
    expect(
      parseLoginInput({ email: "  alex.morgan@gosmart.example ", password: " secret " }),
    ).toEqual({
      ok: true,
      value: { email: "alex.morgan@gosmart.example", password: " secret " },
    });
  });

  it("asks for both fields when they are missing", () => {
    expect(parseLoginInput({ email: null, password: null })).toEqual({
      ok: false,
      fieldErrors: {
        email: ["Enter your e-mail address."],
        password: ["Enter your password."],
      },
    });
  });

  it("asks for both fields when they are empty", () => {
    expect(parseLoginInput({ email: "   ", password: "" })).toEqual({
      ok: false,
      fieldErrors: {
        email: ["Enter your e-mail address."],
        password: ["Enter your password."],
      },
    });
  });

  it("rejects a value that is not an e-mail address", () => {
    expect(parseLoginInput({ email: "alex.morgan", password: "secret" })).toEqual({
      ok: false,
      fieldErrors: { email: ["Enter a valid e-mail address."] },
    });
  });
});
