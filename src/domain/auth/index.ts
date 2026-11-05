import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createAuthService, type AuthService } from "./auth-service";

export type { CurrentUser, SignInResult } from "./auth-service";
export { HOME_PATH, LOGIN_PATH, safeRedirectPath } from "./routes";

/** Auth service bound to the current request's session cookies. */
export async function getAuthService(): Promise<AuthService> {
  const supabase = await createClient();
  return createAuthService(supabase.auth);
}
