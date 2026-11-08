import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { MAX_SESSION_MS, SESSION_COOKIE } from "./cookie-policy";

/** `demo: true` marks the public synthetic demo session: it carries no backend token and is refused by every backend route. */
export type SessionPayload = { t: string; h: string; m: string; exp: number; demo?: true };
export const COOKIE_NAME = SESSION_COOKIE;

const key = (secret: string) => createHash("sha256").update(secret).digest();

/** Key id: a short public fingerprint of the secret (domain-separated hash, not the encryption key). Never reveals the secret. */
export function keyId(secret: string): string {
  return createHash("sha256").update(`kv-kid-v1:${secret}`).digest().subarray(0, 6).toString("base64url");
}

/**
 * AES-256-GCM seal: kid.iv.tag.ciphertext (base64url). The kid is bound in as additional authenticated data, so it cannot
 * be swapped. The backend token never reaches the browser unsealed. Always sealed with the current secret.
 */
export function seal(payload: SessionPayload, secret: string): string {
  const kid = keyId(secret);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  c.setAAD(Buffer.from(kid));
  const enc = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  return [kid, ...[iv, c.getAuthTag(), enc].map((b) => b.toString("base64url"))].join(".");
}

/** Pre-rotation format (3 parts, no kid, no AAD). Only ever tried with the current key. */
export function sealLegacy(payload: SessionPayload, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export type OpenOptions = { previous?: string | null; now?: number; acceptLegacy?: boolean };
export type Opened = { payload: SessionPayload; /** True when the cookie was not sealed with the current key in the current format: re-seal it. */ reseal: boolean };

function decrypt(parts: string[], secret: string, kid: string | null): SessionPayload | null {
  const [iv, tag, enc] = parts.map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !enc || iv.length !== 12 || tag.length !== 16) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(secret), iv);
    if (kid !== null) d.setAAD(Buffer.from(kid));
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Fails closed: unknown kid, bad tag, bad shape, expired, or an expiry beyond the 7 day ceiling all return null.
 * Current key, then the previous key (rotation window). A kid-less cookie from before rotation existed is accepted with the
 * current key only (transition; see docs/cookie-inventory.md) and flagged for re-seal.
 */
export function unseal(sealed: string | undefined, secret: string, opts: OpenOptions = {}): Opened | null {
  if (!sealed || sealed.length > 4096) return null;
  const now = opts.now ?? Date.now();
  const parts = sealed.split(".");
  let payload: SessionPayload | null = null;
  let reseal = false;
  if (parts.length === 4) {
    const kid = parts[0] as string;
    const rest = parts.slice(1);
    if (kid === keyId(secret)) payload = decrypt(rest, secret, kid);
    else if (opts.previous && opts.previous !== secret && kid === keyId(opts.previous)) {
      payload = decrypt(rest, opts.previous, kid);
      reseal = true;
    }
  } else if (parts.length === 3 && opts.acceptLegacy !== false) {
    payload = decrypt(parts, secret, null);
    reseal = true;
  }
  if (!payload) return null;
  if (typeof payload.t !== "string" || typeof payload.h !== "string" || typeof payload.m !== "string" || typeof payload.exp !== "number") return null;
  if (!Number.isFinite(payload.exp) || payload.exp < now || payload.exp > now + MAX_SESSION_MS + 60_000) return null;
  return { payload, reseal };
}

export function open(sealed: string | undefined, secret: string, opts: OpenOptions = {}): SessionPayload | null {
  return unseal(sealed, secret, opts)?.payload ?? null;
}
