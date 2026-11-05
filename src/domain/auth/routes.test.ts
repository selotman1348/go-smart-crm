import { describe, expect, it } from "vitest";

import {
  HOME_PATH,
  LOGIN_PATH,
  resolveAuthRedirect,
  safeRedirectPath,
} from "./routes";

describe("safeRedirectPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/cases?status=closed", "/cases?status=closed"],
    ["/cases/ABC20260001#history", "/cases/ABC20260001#history"],
  ])("keeps the same-site path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["not a string", 42],
    ["empty", ""],
    ["relative", "dashboard"],
    ["absolute URL", "https://evil.example/phish"],
    ["protocol-relative", "//evil.example"],
    ["backslash host", "/\\evil.example"],
    ["tab-smuggled host", "/\t/evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["the login page", "/login"],
    ["the login page with a query", "/login?next=/dashboard"],
  ])("falls back to the home page for %s input", (_label, input) => {
    expect(safeRedirectPath(input)).toBe(HOME_PATH);
  });
});

describe("resolveAuthRedirect", () => {
  it("sends a signed-out user to the login page and remembers the target", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/dashboard",
        search: "?tab=tasks",
        isSignedIn: false,
      }),
    ).toBe(`${LOGIN_PATH}?next=%2Fdashboard%3Ftab%3Dtasks`);
  });

  it("lets a signed-in user through to an app page", () => {
    expect(
      resolveAuthRedirect({ pathname: "/dashboard", search: "", isSignedIn: true }),
    ).toBeNull();
  });

  it("lets a signed-out user open the login page", () => {
    expect(
      resolveAuthRedirect({ pathname: LOGIN_PATH, search: "", isSignedIn: false }),
    ).toBeNull();
  });

  it("sends a signed-in user from the login page to the home page", () => {
    expect(
      resolveAuthRedirect({ pathname: LOGIN_PATH, search: "", isSignedIn: true }),
    ).toBe(HOME_PATH);
  });

  it("sends a signed-in user from the login page to a safe next path", () => {
    expect(
      resolveAuthRedirect({
        pathname: LOGIN_PATH,
        search: "?next=%2Fcases",
        isSignedIn: true,
      }),
    ).toBe("/cases");
  });

  it("ignores an unsafe next path on the login page", () => {
    expect(
      resolveAuthRedirect({
        pathname: LOGIN_PATH,
        search: "?next=https%3A%2F%2Fevil.example",
        isSignedIn: true,
      }),
    ).toBe(HOME_PATH);
  });

  it("does not treat paths that only start with the login path as public", () => {
    expect(
      resolveAuthRedirect({ pathname: "/login-history", search: "", isSignedIn: false }),
    ).toBe(`${LOGIN_PATH}?next=%2Flogin-history`);
  });
});
