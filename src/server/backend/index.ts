import "server-only";
import { cookies, headers } from "next/headers";
import { createBackendClient, type BackendClient } from "./client";
import { acceptLegacyCookies, loadConfig, previousCookieSecret, type ServerConfig } from "./env";
import { seal, unseal, type SessionPayload } from "./session";
import { MAX_SESSION_MS, SESSION_COOKIE, expiring, isSecureRequest, sessionCookieName, sessionFlags, sessionMaxAgeSeconds } from "./cookie-policy";
import { AppError, errorBody } from "./errors";

export { AppError, errorBody };

export function runtime(): { config: ServerConfig; client: BackendClient } {
  const config = loadConfig();
  return { config, client: createBackendClient({ baseUrl: config.apiUrl, bootstrapToken: config.bootstrapToken, identityToken: process.env.KNOWVIA_IDENTITY_TOKEN }) };
}

/** Secure unless a plain-http loopback request. Takes the host from the incoming request headers; no headers means Secure. */
async function requestSecure(): Promise<boolean> {
  try {
    const h = await headers();
    return isSecureRequest({ host: h.get("host"), forwardedProto: h.get("x-forwarded-proto") });
  } catch {
    return true;
  }
}

/**
 * Reads the session with the current secret, then the previous one. A cookie sealed with an older key or format is re-sealed
 * (same expiry) where cookies are writable. Over https the cookie is __Host-kv_session; while the legacy transition is open
 * an old plain kv_session is read once, re-sealed under the new name and the old one is cleared.
 */
export async function readSession(secret: string): Promise<SessionPayload | null> {
  const jar = await cookies();
  const secure = await requestSecure();
  const name = sessionCookieName(secure);
  const legacy = acceptLegacyCookies();
  const opts = { previous: previousCookieSecret(), acceptLegacy: legacy };
  let opened = unseal(jar.get(name)?.value, secret, opts);
  let fromPlain = false;
  if (!opened && secure && legacy) {
    opened = unseal(jar.get(SESSION_COOKIE)?.value, secret, opts);
    fromPlain = opened !== null;
  }
  if (!opened) return null;
  if (opened.reseal || fromPlain) {
    try {
      jar.set(name, seal(opened.payload, secret), sessionFlags(secure, sessionMaxAgeSeconds(opened.payload.exp)));
      if (fromPlain) jar.set(SESSION_COOKIE, "", expiring(sessionFlags(secure, 0)));
    } catch {
      // Server Components cannot set cookies; the next route handler read will re-seal.
    }
  }
  return opened.payload;
}

export async function writeSession(payload: SessionPayload, secret: string, secure?: boolean): Promise<void> {
  const exp = Math.min(payload.exp, Date.now() + MAX_SESSION_MS);
  const isSecure = secure ?? (await requestSecure());
  const jar = await cookies();
  jar.set(sessionCookieName(isSecure), seal({ ...payload, exp }, secret), sessionFlags(isSecure, sessionMaxAgeSeconds(exp)));
  if (isSecure) jar.set(SESSION_COOKIE, "", expiring(sessionFlags(true, 0))); // drop any pre-prefix cookie
}

export async function clearSession(secure?: boolean): Promise<void> {
  const isSecure = secure ?? (await requestSecure());
  const jar = await cookies();
  jar.set(sessionCookieName(isSecure), "", expiring(sessionFlags(isSecure, 0)));
  if (isSecure) jar.set(SESSION_COOKIE, "", expiring(sessionFlags(true, 0)));
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function failure(e: unknown): Response {
  const err = e instanceof AppError ? e : new AppError(500, "BACKEND_UNREACHABLE", true);
  return Response.json(errorBody(err), { status: err.status, headers: retryHeaders(err) });
}

/** no-store always; Retry-After when the error carries one (overload or open circuit). */
export function retryHeaders(err: { retryAfter?: number }): Record<string, string> {
  const h: Record<string, string> = { "cache-control": "no-store" };
  if (err.retryAfter !== undefined) h["retry-after"] = String(err.retryAfter);
  return h;
}
