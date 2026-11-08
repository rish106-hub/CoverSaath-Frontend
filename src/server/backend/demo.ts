import "server-only";
import { timingSafeEqual } from "node:crypto";

// Public synthetic demo login. The credentials are deliberately public. The session it opens carries no backend token and every
// backend route refuses it (readSession), so it can only ever be served synthetic data from the browser mock adapters.
export const DEMO_EMAIL = "demo@demo.com";
const DEMO_PASSWORD = "demo123";
export const DEMO_SESSION_MS = 12 * 60 * 60 * 1000;

export const demoEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => env.DEMO_LOGIN_ENABLED === "true";

const CAP = 256;

/** Fixed-size zero-padded copy so the compare never depends on input length. Null when the input is not a string or is over the cap. */
function padded(v: unknown): Buffer | null {
  if (typeof v !== "string") return null;
  const raw = Buffer.from(v, "utf8");
  if (raw.length > CAP) return null;
  const out = Buffer.alloc(CAP);
  raw.copy(out);
  return out;
}

function same(input: unknown, expected: string, lower: boolean): boolean {
  const given = padded(typeof input === "string" && lower ? input.trim().toLowerCase() : input);
  const want = padded(expected) as Buffer;
  const lenOk = typeof input === "string" && (lower ? input.trim().toLowerCase() : input).length === expected.length;
  const eq = timingSafeEqual(given ?? Buffer.alloc(CAP, 1), want); // over-cap or non-string compares against a filler that never matches
  return eq && lenOk && given !== null;
}

/** Constant-time on fixed-size buffers; no hashing, no early return, both fields always compared. */
export function demoCredentialsMatch(email: unknown, password: unknown): boolean {
  const e = same(email, DEMO_EMAIL, true);
  const p = same(password, DEMO_PASSWORD, false);
  return e && p;
}

/** Synthetic identity for GET /me. Same shape as the real one; nothing here is a real person. */
export const demoMe = () => ({
  householdId: "demo",
  householdName: "Rao family (demo)",
  owner: { id: "demo-owner", displayName: "Meera Rao", email: DEMO_EMAIL },
  source: "mock" as const,
  demo: true as const,
});

/**
 * Client IP from the platform's trusted header: x-real-ip (Vercel sets it, a client cannot override it), else the rightmost
 * x-forwarded-for hop (appended by the nearest proxy; the leftmost is client-controlled). Null when neither is usable.
 */
export function clientIp(h: { get(n: string): string | null }): string | null {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const hop = h.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return hop ? hop.slice(0, 64) : null;
}

// Per process, best effort (serverless instances do not share it). Failed attempts only. Map is hard-capped; oldest evicted.
const fails = new Map<string, { n: number; reset: number }>();
const LIMIT = 8;
const WINDOW_MS = 10 * 60 * 1000;
export const MAX_TRACKED = 1000;

/** No IP means no lockout (credentials are still required, and a lockout keyed on a shared bucket would let anyone lock everyone out). */
export function demoRateLimited(ip: string | null, now = Date.now()): boolean {
  if (!ip) return false;
  const f = fails.get(ip);
  return !!f && f.reset > now && f.n >= LIMIT;
}
export function demoNoteFailure(ip: string | null, now = Date.now()): void {
  if (!ip) return;
  const f = fails.get(ip);
  if (f && f.reset > now) {
    f.n++;
    return;
  }
  fails.delete(ip);
  while (fails.size >= MAX_TRACKED) fails.delete(fails.keys().next().value as string); // Map keeps insertion order: oldest first
  fails.set(ip, { n: 1, reset: now + WINDOW_MS });
}
export const demoTracked = () => fails.size;
export const demoResetLimits = () => fails.clear();
