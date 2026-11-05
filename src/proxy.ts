import type { NextRequest } from "next/server";

import { resolveAuthRedirect } from "@/domain/auth/routes";
import { refreshSession } from "@/lib/supabase/proxy";

// Optimistic check only: pages and Server Actions verify the session again
// through src/domain/auth before they use it.
export async function proxy(request: NextRequest) {
  const session = await refreshSession(request);
  const target = resolveAuthRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isSignedIn: session.isSignedIn,
  });

  return target
    ? session.redirectTo(new URL(target, request.url))
    : session.response;
}

export const config = {
  matcher: [
    // Everything except Next.js assets, the favicon and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
