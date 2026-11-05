import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session for the incoming request and writes any
 * updated auth cookies to the response. Called from `src/proxy.ts`.
 */
export async function refreshSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });
  const authHeaders: Record<string, string> = {};

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache headers that keep CDNs from serving one user's session to another.
        Object.assign(authHeaders, headers);
        for (const [key, value] of Object.entries(authHeaders)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Validates the access token and refreshes it when expired. Keep this call
  // directly after creating the client.
  const { data } = await supabase.auth.getClaims();

  return {
    isSignedIn: Boolean(data?.claims),
    response,
    /** Redirect that keeps the refreshed auth cookies and headers. */
    redirectTo(target: URL) {
      const redirect = NextResponse.redirect(target);
      for (const cookie of response.cookies.getAll()) {
        redirect.cookies.set(cookie);
      }
      for (const [key, value] of Object.entries(authHeaders)) {
        redirect.headers.set(key, value);
      }
      return redirect;
    },
  };
}
