import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getAuthService, LOGIN_PATH } from "@/domain/auth";

import { signOutAction } from "./actions";

/**
 * Shows the signed-in user. Also the server-side session check for every page
 * in this group: without a valid session it redirects to the login page.
 */
export async function UserMenu() {
  const auth = await getAuthService();
  const user = await auth.getCurrentUser();
  if (!user) {
    redirect(LOGIN_PATH);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground" title={user.email}>
        {user.fullName}
      </span>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
