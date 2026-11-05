import { describe, expect, it, vi } from "vitest";

import {
  createAuthService,
  INVALID_CREDENTIALS_MESSAGE,
  SIGN_IN_FAILED_MESSAGE,
  TOO_MANY_ATTEMPTS_MESSAGE,
  type AuthClient,
} from "./auth-service";

const credentials = { email: "alex.morgan@gosmart.example", password: "secret" };

function fakeAuthClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    getClaims: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  };
}

describe("signIn", () => {
  it("signs in with valid credentials", async () => {
    const client = fakeAuthClient();

    await expect(createAuthService(client).signIn(credentials)).resolves.toEqual({
      ok: true,
    });
    expect(client.signInWithPassword).toHaveBeenCalledWith(credentials);
  });

  it("returns field errors without calling Supabase when input is invalid", async () => {
    const client = fakeAuthClient();

    const result = await createAuthService(client).signIn({ email: "", password: "" });

    expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.any(Array) } });
    expect(client.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong password", { status: 400, code: "invalid_credentials" }],
    ["unconfirmed e-mail address", { status: 400, code: "email_not_confirmed" }],
  ])("gives one generic message for a %s", async (_label, error) => {
    const client = fakeAuthClient({ signInWithPassword: async () => ({ error }) });

    await expect(createAuthService(client).signIn(credentials)).resolves.toEqual({
      ok: false,
      formError: INVALID_CREDENTIALS_MESSAGE,
    });
  });

  it("explains rate limiting", async () => {
    const client = fakeAuthClient({
      signInWithPassword: async () => ({
        error: { status: 429, code: "over_request_rate_limit" },
      }),
    });

    await expect(createAuthService(client).signIn(credentials)).resolves.toEqual({
      ok: false,
      formError: TOO_MANY_ATTEMPTS_MESSAGE,
    });
  });

  it("reports an unexpected failure without details", async () => {
    const client = fakeAuthClient({
      signInWithPassword: async () => ({ error: { status: 500 } }),
    });

    await expect(createAuthService(client).signIn(credentials)).resolves.toEqual({
      ok: false,
      formError: SIGN_IN_FAILED_MESSAGE,
    });
  });
});

describe("signOut", () => {
  it("ends only the current browser session", async () => {
    const client = fakeAuthClient();

    await createAuthService(client).signOut();

    expect(client.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("getCurrentUser", () => {
  it("returns the signed-in user from the token claims", async () => {
    const client = fakeAuthClient({
      getClaims: async () => ({
        data: {
          claims: {
            sub: "user-1",
            email: "alex.morgan@gosmart.example",
            user_metadata: { full_name: "Alex Morgan" },
          },
        },
        error: null,
      }),
    });

    await expect(createAuthService(client).getCurrentUser()).resolves.toEqual({
      id: "user-1",
      email: "alex.morgan@gosmart.example",
      fullName: "Alex Morgan",
    });
  });

  it("falls back to the e-mail address when there is no name", async () => {
    const client = fakeAuthClient({
      getClaims: async () => ({
        data: { claims: { sub: "user-2", email: "sam.taylor@gosmart.example" } },
        error: null,
      }),
    });

    await expect(createAuthService(client).getCurrentUser()).resolves.toMatchObject({
      fullName: "sam.taylor@gosmart.example",
    });
  });

  it("returns null without a session", async () => {
    await expect(createAuthService(fakeAuthClient()).getCurrentUser()).resolves.toBeNull();
  });

  it("returns null when the token cannot be verified", async () => {
    const client = fakeAuthClient({
      getClaims: async () => ({ data: null, error: new Error("invalid JWT") }),
    });

    await expect(createAuthService(client).getCurrentUser()).resolves.toBeNull();
  });
});
