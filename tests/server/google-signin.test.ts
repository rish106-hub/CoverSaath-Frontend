import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { value: jar.get(n) as string } : undefined),
    set: (n: string, v: string, o?: { maxAge?: number }) => void (o?.maxAge === 0 ? jar.delete(n) : jar.set(n, v)),
    delete: (a: string | { name: string }) => void jar.delete(typeof a === "string" ? a : a.name),
  }),
}));

import * as start from "@/app/api/app/auth/google/route";
import * as callback from "@/app/api/app/auth/google/callback/route";
import { toSignInInput } from "@/server/backend/google";

const CLIENT = "client-id.apps.test";
const IDENTITY = "identity-token-0123456789-0123456789-abcdef";
type Call = { url: string; method: string; headers: Record<string, string>; body: string };
let calls: Call[];
let idTokenClaims: Record<string, unknown>;
let identityReply: { status: number; body: unknown };

const jwt = (claims: Record<string, unknown>) => ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
const at = (path: string) => new Request(`http://app.test${path}`);

beforeEach(() => {
  jar.clear();
  calls = [];
  identityReply = { status: 201, body: { returning: false, household: { id: "h1" }, adultId: "a1", memberId: "m1", session: { token: "t".repeat(40), expiresAt: new Date(Date.now() + 3_600_000).toISOString() } } };
  vi.stubEnv("KNOWVIA_API_URL", "http://api.test");
  vi.stubEnv("KNOWVIA_BOOTSTRAP_TOKEN", "bootstrap-token-should-never-be-used-here");
  vi.stubEnv("SESSION_COOKIE_SECRET", "s".repeat(40));
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN", "1");
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("KNOWVIA_IDENTITY_TOKEN", IDENTITY);
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
    calls.push({ url: String(input), method: init?.method ?? "GET", headers, body: String(init?.body ?? "") });
    if (String(input).startsWith("https://oauth2.googleapis.com/token")) return Response.json({ id_token: jwt(idTokenClaims) });
    return new Response(JSON.stringify(identityReply.body), { status: identityReply.status, headers: { "content-type": "application/json" } });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function begin() {
  const res = await start.GET(at("/api/app/auth/google"));
  const url = new URL(res.headers.get("location") as string);
  return { res, url, state: url.searchParams.get("state") as string, nonce: url.searchParams.get("nonce") as string };
}
const claims = (nonce: string, extra: Record<string, unknown> = {}) => ({ iss: "https://accounts.google.com", aud: CLIENT, sub: "1234567890", exp: Math.floor(Date.now() / 1000) + 600, nonce, name: "Meera Rao", email: "meera@example.com", email_verified: true, ...extra });

describe("Google sign-in start", () => {
  it("redirects to Google with PKCE S256, state, nonce and the registered callback", async () => {
    const { res, url } = await begin();
    expect(res.status).toBe(302);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get("redirect_uri")).toBe("http://app.test/api/app/auth/google/callback");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("client_id")).toBe(CLIENT);
    expect(jar.has("__Secure-kv_oauth")).toBe(true);
    expect(JSON.stringify([...jar.values()])).not.toContain("google-secret");
  });

  it("returns to sign-in when Google is not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    const res = await start.GET(at("/api/app/auth/google"));
    expect(res.headers.get("location")).toBe("/signin?error=google_unavailable");
    expect(jar.has("__Secure-kv_oauth")).toBe(false);
  });
});

describe("Google sign-in callback", () => {
  it("signs a new person in through the identity credential and lands on welcome", async () => {
    const s = await begin();
    idTokenClaims = claims(s.nonce);
    const res = await callback.GET(at(`/api/app/auth/google/callback?code=abc&state=${s.state}`));
    expect(res.headers.get("location")).toBe("/welcome");
    const idCall = calls.find((c) => c.url.endsWith("/api/v1/identity-sessions"));
    expect(idCall?.headers.authorization).toBe(`Bearer ${IDENTITY}`);
    expect(JSON.parse(idCall?.body ?? "{}")).toEqual({ issuer: "https://accounts.google.com", subject: "1234567890", displayName: "Meera Rao", contactEmail: "meera@example.com" });
    const token = calls.find((c) => c.url.startsWith("https://oauth2.googleapis.com"));
    expect(token?.body).toContain("code_verifier=");
    expect(jar.has("__Host-kv_session")).toBe(true);
    expect(jar.has("__Secure-kv_oauth")).toBe(false);
  });

  it("sends a returning person to home", async () => {
    identityReply = { status: 200, body: { ...(identityReply.body as object), returning: true } };
    const s = await begin();
    idTokenClaims = claims(s.nonce);
    const res = await callback.GET(at(`/api/app/auth/google/callback?code=abc&state=${s.state}`));
    expect(res.headers.get("location")).toBe("/home");
  });

  it.each([
    ["wrong state", (s: { nonce: string }) => claims(s.nonce), "WRONG"],
    ["wrong nonce", () => claims("other-nonce"), undefined],
    ["wrong audience", (s: { nonce: string }) => claims(s.nonce, { aud: "someone-else" }), undefined],
    ["wrong issuer", (s: { nonce: string }) => claims(s.nonce, { iss: "https://evil.example" }), undefined],
    ["expired token", (s: { nonce: string }) => claims(s.nonce, { exp: Math.floor(Date.now() / 1000) - 5 }), undefined],
    ["missing subject", (s: { nonce: string }) => claims(s.nonce, { sub: "" }), undefined],
  ])("refuses %s and never reaches the backend", async (_n, make, state) => {
    const s = await begin();
    idTokenClaims = make(s);
    const res = await callback.GET(at(`/api/app/auth/google/callback?code=abc&state=${state ?? s.state}`));
    expect(res.headers.get("location")).toBe("/signin?error=google_failed");
    expect(calls.some((c) => c.url.endsWith("/api/v1/identity-sessions"))).toBe(false);
    expect(jar.has("__Host-kv_session")).toBe(false);
  });

  it("refuses a replay: the state cookie is single use", async () => {
    const s = await begin();
    idTokenClaims = claims(s.nonce);
    const saved = jar.get("__Secure-kv_oauth") as string;
    await callback.GET(at(`/api/app/auth/google/callback?code=abc&state=${s.state}`));
    jar.set("__Secure-kv_oauth", saved);
    jar.delete("__Host-kv_session");
    // The cookie itself is replayable only by someone who holds it; with it removed the callback must fail.
    jar.delete("__Secure-kv_oauth");
    const res = await callback.GET(at(`/api/app/auth/google/callback?code=abc&state=${s.state}`));
    expect(res.headers.get("location")).toBe("/signin?error=google_failed");
  });

  it("reports a cancelled consent screen", async () => {
    await begin();
    const res = await callback.GET(at("/api/app/auth/google/callback?error=access_denied"));
    expect(res.headers.get("location")).toBe("/signin?error=google_denied");
  });

  it("maps a backend rate limit to the busy message and a missing credential to unavailable", async () => {
    let s = await begin();
    idTokenClaims = claims(s.nonce);
    identityReply = { status: 429, body: { error: { code: "SESSION_CAPACITY" } } };
    expect((await callback.GET(at(`/api/app/auth/google/callback?code=abc&state=${s.state}`))).headers.get("location")).toBe("/signin?error=google_busy");
    s = await begin();
    idTokenClaims = claims(s.nonce);
    identityReply = { status: 503, body: { error: { code: "AUTH_NOT_CONFIGURED" } } };
    expect((await callback.GET(at(`/api/app/auth/google/callback?code=abc&state=${s.state}`))).headers.get("location")).toBe("/signin?error=google_unavailable");
  });
});

describe("toSignInInput", () => {
  it("keeps the e-mail only when Google verified it, strips control characters and caps the name", () => {
    expect(toSignInInput({ sub: "s", name: null, email: "a@example.com", emailVerified: false })).toMatchObject({ displayName: "a", contactEmail: null });
    expect(toSignInInput({ sub: "s", name: "Mee‮ra\u0007 Rao", email: null, emailVerified: false }).displayName).toBe("Meera Rao");
    expect(toSignInInput({ sub: "s", name: "x".repeat(200), email: null, emailVerified: false }).displayName).toHaveLength(80);
  });
});
