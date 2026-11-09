import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** t backend token, h household, m owner member, a adult id (needed to grant consent; absent on older sessions), exp ms, d marks the one demo session: a pure mock session with no backend token. */
export type SessionPayload = { t: string; h: string; m: string; a?: string; exp: number; d?: boolean };
export const COOKIE_NAME = "kv_session";

const key = (secret: string) => createHash("sha256").update(secret).digest();

/** AES-256-GCM seal: iv.tag.ciphertext (base64url). The backend token never reaches the browser unsealed. */
export function seal(payload: SessionPayload, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function open(sealed: string | undefined, secret: string): SessionPayload | null {
  if (!sealed) return null;
  try {
    const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    if (!iv || !tag || !enc) return null;
    const d = createDecipheriv("aes-256-gcm", key(secret), iv);
    d.setAuthTag(tag);
    const p = JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")) as SessionPayload;
    if (typeof p.t !== "string" || typeof p.h !== "string" || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    if (p.d !== undefined && p.d !== true) return null;
    return p;
  } catch {
    return null;
  }
}

/** Same seal for other small server-held state (the documents cookie). Returns null on any tamper, wrong key or expiry. */
export function sealValue<T extends { exp: number }>(value: T, secret: string): string {
  return seal(value as unknown as SessionPayload, secret);
}
export function openValue<T extends { exp: number }>(sealed: string | undefined, secret: string): T | null {
  if (!sealed) return null;
  try {
    const [iv, tag, enc] = sealed.split(".").map((x) => Buffer.from(x, "base64url"));
    if (!iv || !tag || !enc) return null;
    const d = createDecipheriv("aes-256-gcm", key(secret), iv);
    d.setAuthTag(tag);
    const v = JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")) as T;
    return typeof v.exp === "number" && v.exp >= Date.now() ? v : null;
  } catch {
    return null;
  }
}
