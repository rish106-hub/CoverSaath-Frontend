import "server-only";
import { isSecureRequest } from "@/server/backend/cookie-policy";

/**
 * Analytics consent cookie. Non-essential: it is set only after the person makes a choice, never by default.
 * Value is `granted.<anonymous id>` or `denied`. The anonymous id is random, unrelated to the session, household or
 * member, and is the only distinct id ever sent. Wording shown to people is FOR LEGAL REVIEW.
 */
export const CONSENT_COOKIE = "kv_analytics";
export const CONSENT_COOKIE_SECURE = "__Host-kv_analytics";
export const CONSENT_MAX_AGE_S = 180 * 24 * 60 * 60;
const ID = /^[0-9a-f]{32}$/;

export type Consent = { granted: true; id: string } | { granted: false };

export const consentCookieName = (secure: boolean): string => (secure ? CONSENT_COOKIE_SECURE : CONSENT_COOKIE);

export function parseConsent(value: string | undefined): Consent {
  const m = /^granted\.([0-9a-f]{32})$/.exec(value ?? "");
  return m && ID.test(m[1]) ? { granted: true, id: m[1] } : { granted: false };
}

/** Reads the cookie from the raw Cookie header. No cookie or any malformed value means no consent. */
export function readConsent(req: Request): Consent {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CONSENT_COOKIE_SECURE || name === CONSENT_COOKIE) {
      const c = parseConsent(rest.join("="));
      if (c.granted) return c;
    }
  }
  return { granted: false };
}

export function requestIsSecure(req: Request): boolean {
  return isSecureRequest({ host: req.headers.get("host"), forwardedProto: req.headers.get("x-forwarded-proto") });
}

export function newAnonymousId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
