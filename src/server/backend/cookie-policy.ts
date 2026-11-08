/**
 * Cookie policy for every cookie this app sets. One place, so the flags cannot drift per route.
 * Secure is the default. It is dropped only when the request host is a loopback name AND the request did not arrive over
 * https (a local dev server on plain http). NODE_ENV is deliberately not consulted: a production build served on
 * localhost behaves the same as dev, and a non-production deploy on a real host stays Secure.
 */
/** Plain names: loopback http development, and the pre-prefix cookies still read during the legacy transition. */
export const SESSION_COOKIE = "kv_session";
/** Readable (not HttpOnly) marker for a demo session. Not a credential: the sealed session is the authority. */
export const DEMO_COOKIE = "kv_demo";
export const OAUTH_COOKIE_NAME = "kv_oauth";
/** Prefixed names, used whenever the cookie is Secure. __Host- needs Secure, Path=/ and no Domain (the session cookie). __Secure- needs Secure only (the oauth cookie is path-scoped, so it cannot be __Host-). */
export const SESSION_COOKIE_SECURE = "__Host-kv_session";
export const OAUTH_COOKIE_SECURE = "__Secure-kv_oauth";
export const sessionCookieName = (secure: boolean): string => (secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE);
export const oauthCookieName = (secure: boolean): string => (secure ? OAUTH_COOKIE_SECURE : OAUTH_COOKIE_NAME);
export const OAUTH_COOKIE_PATH = "/api/app/auth/google";
/** Hard ceiling on a session, whatever the backend says. */
export const MAX_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_SESSION_MAX_AGE_S = 60;
/** State, nonce and PKCE verifier live only for the Google round trip. */
export const OAUTH_COOKIE_MAX_AGE_S = 600;

export type CookieFlags = { httpOnly: true; sameSite: "lax"; secure: boolean; path: string; maxAge: number };

/** Hostname without port or brackets, lower-cased. Empty string when unusable. */
export function hostnameOf(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "";
  const first = hostHeader.split(",")[0]?.trim().toLowerCase() ?? "";
  const m = first.startsWith("[") ? /^\[([^\]]*)\]/.exec(first) : /^([^:]*)/.exec(first);
  return m?.[1] ?? "";
}

export function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * True (Secure on) unless this is a plain-http request to a loopback host. Unknown host fails closed to Secure.
 * Secure is never dropped when COOKIE_SECURE=always, on Vercel (VERCEL is set), or when APP_ORIGIN is an https origin:
 * those deploys are never local development, whatever Host header arrives.
 */
export function isSecureRequest(input: { host?: string | null; forwardedProto?: string | null }, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.COOKIE_SECURE === "always" || env.VERCEL || env.APP_ORIGIN?.toLowerCase().startsWith("https://")) return true;
  const proto = input.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (proto === "https") return true;
  return !isLoopbackHost(hostnameOf(input.host));
}

export function sessionFlags(secure: boolean, maxAge: number): CookieFlags {
  return { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge };
}

export function oauthFlags(secure: boolean): CookieFlags {
  return { httpOnly: true, sameSite: "lax", secure, path: OAUTH_COOKIE_PATH, maxAge: OAUTH_COOKIE_MAX_AGE_S };
}

/** Max-Age follows the (clamped) expiry, never above the 7 day ceiling and never below 60 seconds. */
export function sessionMaxAgeSeconds(exp: number, now = Date.now()): number {
  const s = Math.floor((Math.min(exp, now + MAX_SESSION_MS) - now) / 1000);
  return Math.max(MIN_SESSION_MAX_AGE_S, s);
}

/** Flags that expire a cookie immediately. Same attributes as the cookie it removes, or some browsers keep it. */
export function expiring(flags: CookieFlags): CookieFlags & { expires: Date } {
  return { ...flags, maxAge: 0, expires: new Date(0) };
}
