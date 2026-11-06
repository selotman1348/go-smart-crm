export const LOGIN_PATH = "/login";
export const HOME_PATH = "/dashboard";

/** Routes that can be opened without a session. */
const PUBLIC_PATHS = [LOGIN_PATH];

/**
 * Called by external services, which check their own credentials (the
 * inbound e-mail webhook's shared secret, Vercel Cron's secret, API keys);
 * never redirected.
 */
const WEBHOOK_PATHS = ["/api/inbound-email", "/api/events/dispatch"];
const API_PREFIX = "/api/v1/";

const ORIGIN_PLACEHOLDER = "http://internal.invalid";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Returns a same-site path to continue to after signing in. Anything that
 * could leave the site (absolute URLs, `//host`, `/\host`) or that points back
 * to the login page falls back to the home page, preventing open redirects.
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return HOME_PATH;
  }

  let url: URL;
  try {
    url = new URL(value, ORIGIN_PLACEHOLDER);
  } catch {
    return HOME_PATH;
  }

  if (url.origin !== ORIGIN_PLACEHOLDER || isPublicPath(url.pathname)) {
    return HOME_PATH;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Decides whether a request must be redirected before it reaches a page:
 * signed-out users go to the login page (remembering where they were going),
 * and signed-in users skip the login page. Returns `null` to continue.
 */
export function resolveAuthRedirect(request: {
  pathname: string;
  search: string;
  isSignedIn: boolean;
}): string | null {
  const { pathname, search, isSignedIn } = request;

  if (WEBHOOK_PATHS.includes(pathname) || pathname.startsWith(API_PREFIX)) {
    return null;
  }

  if (isPublicPath(pathname)) {
    if (!isSignedIn) {
      return null;
    }
    return safeRedirectPath(new URLSearchParams(search).get("next"));
  }

  if (isSignedIn) {
    return null;
  }
  const next = encodeURIComponent(`${pathname}${search}`);
  return `${LOGIN_PATH}?next=${next}`;
}
