import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type SessionPayload = { t: string; h: string; m: string; exp: number };
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
    return p;
  } catch {
    return null;
  }
}
