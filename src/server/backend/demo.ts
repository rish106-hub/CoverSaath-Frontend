import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { SessionPayload } from "./session";

// The single demo login. Only this credential gets demo (mock) data; every other account gets the real pathway.
// DEMO_EMAIL and DEMO_PASSWORD override the defaults. The demo session never carries a backend token and never calls the backend.

const DEFAULT_EMAIL = "demo@demo.com";
const DEFAULT_PASSWORD = "demo123";

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export function demoCredentials(env: NodeJS.ProcessEnv = process.env): { email: string; password: string } {
  return { email: (env.DEMO_EMAIL || DEFAULT_EMAIL).trim().toLowerCase(), password: env.DEMO_PASSWORD || DEFAULT_PASSWORD };
}

/** True when the email is the demo account's. The password is checked separately, so the demo email can never fall through to a real account. */
export function isDemoEmail(email: unknown, env?: NodeJS.ProcessEnv): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === demoCredentials(env).email;
}

/** Constant-time check of both fields. Both are always compared so timing does not reveal which was wrong. */
export function checkDemoLogin(email: unknown, password: unknown, env?: NodeJS.ProcessEnv): boolean {
  const c = demoCredentials(env);
  const e = same(typeof email === "string" ? email.trim().toLowerCase() : "", c.email);
  const p = same(typeof password === "string" ? password : "", c.password);
  return e && p;
}

export const DEMO_NAME = "Meera Rao";

/** Sealed like any session but flagged demo, with no real token or household. 12 hours. */
export function demoSession(): SessionPayload {
  return { t: "demo", h: "demo", m: "demo", exp: Date.now() + 12 * 3_600_000, d: true };
}
