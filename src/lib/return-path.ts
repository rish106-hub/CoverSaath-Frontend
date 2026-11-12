import { PAGES } from "@/lib/ia";

/**
 * One validator for the "where to go after sign-in" path. Used by the proxy, the sign-in screens and the Google
 * callback, so an open redirect has exactly one place to be wrong. Pure: no env, no DOM.
 *
 * Accepts only a same-origin relative path that is a known app section (route patterns from src/lib/ia.ts, plus
 * /upload). No query, no fragment, no scheme or host, no "//", no backslash, no control characters, and no "%"
 * at all (so no encoded variants of any of those).
 */

export const RETURN_PARAM = "next";
export const MAX_RETURN_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_NAME_LENGTH = 80;

/** Guarded sections that are not in the page registry (the /upload route redirects to /covers/add). */
const EXTRA_SECTIONS = ["/upload"];

const SEGMENT = /^[A-Za-z0-9_-]{1,80}$/;
const SAFE_CHARS = /^\/[A-Za-z0-9_\-/]*$/;

type Section = { parts: string[] };
const SECTIONS: Section[] = [...PAGES.map((p) => p.route), ...EXTRA_SECTIONS].map((r) => ({ parts: r.split("/").slice(1) }));

/** Returns the path when it is safe to redirect to, otherwise null. */
export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_RETURN_LENGTH) return null;
  if (!SAFE_CHARS.test(raw) || raw.includes("//")) return null;
  const clean = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  const parts = clean.split("/").slice(1);
  const hit = SECTIONS.some((s) => s.parts.length === parts.length && s.parts.every((p, i) => (p.startsWith("[") ? SEGMENT.test(parts[i]!) : p === parts[i])));
  return hit ? clean : null;
}

/** The safe return path, or the fallback. */
export function returnPathOr(raw: unknown, fallback: string): string {
  return safeReturnPath(raw) ?? fallback;
}

/** Reads `next` from a query string (with or without the leading "?"). */
export function returnPathFromSearch(search: string): string | null {
  return safeReturnPath(new URLSearchParams(search).get(RETURN_PARAM));
}

/** Builds /signin with the return path and the (length-capped) email and name carried over. */
export function signInUrl(from: { path?: string | null; email?: string | null; name?: string | null }): string {
  const q = new URLSearchParams();
  const next = safeReturnPath(from.path);
  if (next) q.set(RETURN_PARAM, next);
  const email = from.email?.trim().slice(0, MAX_EMAIL_LENGTH);
  const name = from.name?.trim().slice(0, MAX_NAME_LENGTH);
  if (email) q.set("email", email);
  if (name) q.set("name", name);
  const s = q.toString();
  return s ? `/signin?${s}` : "/signin";
}
