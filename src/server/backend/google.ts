import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "./errors";
import { OAUTH_COOKIE_MAX_AGE_S, OAUTH_COOKIE_NAME } from "./cookie-policy";

/**
 * Google sign-in, server-side authorization-code flow with PKCE, state and nonce.
 * The ID token is received directly from Google's token endpoint over TLS, so (OIDC Core 3.1.3.7) its signature is not
 * re-verified here; issuer, audience, expiry, nonce and subject are. The browser never sees a token or the client secret.
 * The identity the backend stores is (issuer, subject) only, never the e-mail address (ADR 0012 D3).
 */
export const GOOGLE_ISSUER = "https://accounts.google.com";
export const OAUTH_COOKIE = OAUTH_COOKIE_NAME;
export const CALLBACK_PATH = "/api/app/auth/google/callback";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_TTL_MS = OAUTH_COOKIE_MAX_AGE_S * 1000;

export type GoogleConfig = { clientId: string; clientSecret: string; identityToken: string };

/** Null when any piece is missing: the start route then sends the visitor back to sign-in with a coded error. */
export function googleConfig(env: NodeJS.ProcessEnv = process.env): GoogleConfig | null {
  if (env.NEXT_PUBLIC_GOOGLE_SIGNIN !== "1") return null; // feature flag: off unless a deploy opts in (stays off in production until the owner enables it)
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const identityToken = env.KNOWVIA_IDENTITY_TOKEN;
  if (!clientId || !clientSecret || !identityToken) return null;
  return { clientId, clientSecret, identityToken };
}

/** The redirect URI must equal the one registered with Google. Production uses the Vercel production host; dev uses the request. */
export function redirectUri(req: Request, env: NodeJS.ProcessEnv = process.env): string {
  const prod = env.APP_ORIGIN || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const origin = env.NODE_ENV === "production" ? prod : new URL(req.url).origin;
  if (!origin) throw new AppError(503, "CONFIG_MISSING");
  return `${origin.replace(/\/+$/, "")}${CALLBACK_PATH}`;
}

const b64 = (b: Buffer) => b.toString("base64url");

export type OAuthStart = { state: string; nonce: string; verifier: string; challenge: string };
export function newOAuthStart(): OAuthStart {
  const verifier = b64(randomBytes(48));
  return { state: b64(randomBytes(24)), nonce: b64(randomBytes(24)), verifier, challenge: b64(createHash("sha256").update(verifier).digest()) };
}

export function authorizeUrl(cfg: GoogleConfig, start: OAuthStart, redirect: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "openid email profile",
    state: start.state,
    nonce: start.nonce,
    code_challenge: start.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${q.toString()}`;
}

// ---- Short-lived sealed cookie carrying state, nonce and the PKCE verifier (AES-256-GCM, domain-separated key) ----------

export type OAuthCookie = { s: string; n: string; v: string; exp: number; r?: string };
const cookieKey = (secret: string) => createHash("sha256").update(`kv-oauth-v1:${secret}`).digest();

export function sealOAuth(start: OAuthStart, secret: string, now = Date.now(), returnTo?: string | null): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cookieKey(secret), iv);
  const payload: OAuthCookie = { s: start.state, n: start.nonce, v: start.verifier, exp: now + STATE_TTL_MS, ...(returnTo ? { r: returnTo } : {}) };
  const enc = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b64).join(".");
}

export function openOAuth(sealed: string | undefined, secret: string, now = Date.now(), previous?: string | null): OAuthCookie | null {
  if (!sealed || sealed.length > 2048) return null;
  const secrets = previous && previous !== secret ? [secret, previous] : [secret];
  for (const candidate of secrets) {
    const p = tryOpenOAuth(sealed, candidate, now);
    if (p) return p;
  }
  return null;
}

function tryOpenOAuth(sealed: string, secret: string, now: number): OAuthCookie | null {
  try {
    const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    if (!iv || !tag || !enc) return null;
    const d = createDecipheriv("aes-256-gcm", cookieKey(secret), iv);
    d.setAuthTag(tag);
    const p = JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")) as OAuthCookie;
    if (typeof p.s !== "string" || typeof p.n !== "string" || typeof p.v !== "string" || typeof p.exp !== "number" || p.exp < now || p.exp > now + STATE_TTL_MS + 60_000) return null;
    return p;
  } catch {
    return null;
  }
}

// ---- Code exchange and ID token checks -------------------------------------------------------------------------------

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function exchangeCode(
  cfg: GoogleConfig,
  input: { code: string; verifier: string; redirect: string },
  doFetch: FetchLike = fetch,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirect,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: input.verifier,
  });
  let res: Response;
  try {
    res = await doFetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError(503, "BACKEND_UNREACHABLE", true);
  }
  if (!res.ok) throw new AppError(502, "BACKEND_REJECTED");
  const json = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!json || typeof json.id_token !== "string" || json.id_token.split(".").length !== 3) throw new AppError(502, "BACKEND_BAD_RESPONSE");
  return json.id_token;
}

export type GoogleClaims = { sub: string; name: string | null; email: string | null; emailVerified: boolean };

export function readIdToken(idToken: string, expect: { clientId: string; nonce: string }, now = Date.now()): GoogleClaims {
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new AppError(502, "BACKEND_BAD_RESPONSE");
  }
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  const iss = c.iss === GOOGLE_ISSUER || c.iss === "accounts.google.com";
  const exp = typeof c.exp === "number" ? c.exp * 1000 : 0;
  if (!iss || !aud.includes(expect.clientId) || exp <= now || c.nonce !== expect.nonce) throw new AppError(401, "UNAUTHENTICATED");
  if (typeof c.sub !== "string" || c.sub.length < 1 || c.sub.length > 255) throw new AppError(401, "UNAUTHENTICATED");
  return {
    sub: c.sub,
    name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : null,
    email: typeof c.email === "string" ? c.email : null,
    emailVerified: c.email_verified === true,
  };
}

/** Drops control, bidi and line-separator characters, collapses nothing else, caps at 80 characters. */
function cleanName(value: string): string {
  let out = "";
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    const bad = c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
    if (!bad) out += ch;
  }
  return out.trim().slice(0, 80).trim();
}

/** What the backend needs. The e-mail is passed only when Google verified it, and is never the identity key. */
export function toSignInInput(claims: GoogleClaims): { issuer: string; subject: string; displayName: string; contactEmail: string | null } {
  const fallback = claims.email ? claims.email.split("@")[0] : "Knowvia member";
  const displayName = cleanName(claims.name ?? fallback) || "Knowvia member";
  return { issuer: GOOGLE_ISSUER, subject: claims.sub, displayName, contactEmail: claims.emailVerified && claims.email && claims.email.length <= 254 ? claims.email : null };
}
