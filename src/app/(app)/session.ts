import "server-only";

import { redirect } from "next/navigation";

import { getAuthService, LOGIN_PATH, type CurrentUser } from "@/domain/auth";

/** For Server Actions and pages: the signed-in user, or a redirect to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const auth = await getAuthService();
  const user = await auth.getCurrentUser();
  if (!user) {
    redirect(LOGIN_PATH);
  }
  return user;
}
