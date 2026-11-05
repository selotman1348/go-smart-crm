import { parseLoginInput, type LoginFieldErrors } from "./login-input";

/** The part of the Supabase Auth client this service needs. */
export interface AuthClient {
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ error: { status?: number; code?: string } | null }>;
  signOut(options: { scope: "local" }): Promise<{ error: unknown }>;
  getClaims(): Promise<{
    data: {
      claims: {
        sub: string;
        email?: string;
        user_metadata?: Record<string, unknown>;
      };
    } | null;
    error: unknown;
  }>;
}

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
};

export type SignInResult =
  | { ok: true }
  | { ok: false; fieldErrors?: LoginFieldErrors; formError?: string };

export const INVALID_CREDENTIALS_MESSAGE = "Invalid e-mail or password.";
export const TOO_MANY_ATTEMPTS_MESSAGE =
  "Too many sign-in attempts. Please wait a moment and try again.";
export const SIGN_IN_FAILED_MESSAGE =
  "Signing in is not possible right now. Please try again.";

export function createAuthService(auth: AuthClient) {
  return {
    async signIn(input: unknown): Promise<SignInResult> {
      const parsed = parseLoginInput(input);
      if (!parsed.ok) {
        return { ok: false, fieldErrors: parsed.fieldErrors };
      }

      const { error } = await auth.signInWithPassword(parsed.value);
      if (!error) {
        return { ok: true };
      }
      if (error.status === 429) {
        return { ok: false, formError: TOO_MANY_ATTEMPTS_MESSAGE };
      }
      // One message for every rejected credential, so the form does not
      // reveal which e-mail addresses have an account.
      if (error.status === 400) {
        return { ok: false, formError: INVALID_CREDENTIALS_MESSAGE };
      }
      return { ok: false, formError: SIGN_IN_FAILED_MESSAGE };
    },

    async signOut(): Promise<void> {
      // "local" ends this browser's session only; the default ("global")
      // would also sign the user out on their other devices.
      await auth.signOut({ scope: "local" });
    },

    async getCurrentUser(): Promise<CurrentUser | null> {
      const { data, error } = await auth.getClaims();
      if (error || !data) {
        return null;
      }

      const { sub, email = "", user_metadata } = data.claims;
      const fullName = user_metadata?.full_name;
      return {
        id: sub,
        email,
        fullName:
          typeof fullName === "string" && fullName.trim() ? fullName : email,
      };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
