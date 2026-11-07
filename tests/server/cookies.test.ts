import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// A real Next cookie jar: set() records what the app asked for and the Set-Cookie header is serialised by Next itself.
let out = NextResponse.next();
const inbound = new Map<string, string>();
let reqHeaders: Record<string, string>;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (inbound.has(n) ? { value: inbound.get(n) as string } : undefined),
    set: (n: string, v: string, o?: Record<string, unknown>) => void out.cookies.set(n, v, o),
  }),
  headers: async () => ({ get: (n: string) => reqHeaders[n.toLowerCase()] ?? null }),
}));

import { clearSession, readSession, writeSession } from "@/server/backend";
import { keyId, open, seal, sealLegacy, unseal, type SessionPayload } from "@/server/backend/session";
import { isSecureRequest, sessionMaxAgeSeconds, MAX_SESSION_MS, sessionCookieName, oauthCookieName } from "@/server/backend/cookie-policy";
import { previousCookieSecret } from "@/server/backend/env";
import * as start from "@/app/api/app/auth/google/route";
import * as callback from "@/app/api/app/auth/google/callback/route";

const SESS = "__Host-kv_session";
const OAUTH = "__Secure-kv_oauth";
const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);
const payload = (exp = Date.now() + 3_600_000): SessionPayload => ({ t: "tok", h: "h1", m: "m1", exp });

/** All Set-Cookie header lines for one cookie name, newest last. */
const setCookies = (name: string): string[] => out.headers.getSetCookie().filter((l) => l.startsWith(`${name}=`));
const last = (name: string): string => setCookies(name).at(-1) as string;
const attrs = (line: string): string[] => line.split(";").slice(1).map((a) => a.trim());
const has = (line: string, a: string): boolean => attrs(line).some((x) => x.toLowerCase() === a.toLowerCase());
const attr = (line: string, k: string): string | undefined => attrs(line).find((a) => a.toLowerCase().startsWith(`${k.toLowerCase()}=`))?.split("=")[1];
const valueOf = (line: string): string => line.split(";")[0]!.split("=")[1] as string;

beforeEach(() => {
  out = NextResponse.next(); // fresh jar per test, nothing leaks between cases
  inbound.clear();
  reqHeaders = { host: "app.knowvia.test", "x-forwarded-proto": "https" };
  vi.stubEnv("SESSION_COOKIE_SECRET", A);
  vi.stubEnv("SESSION_COOKIE_SECRET_PREVIOUS", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("COOKIE_SECURE", "");
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("SESSION_COOKIE_ACCEPT_LEGACY", "");
  vi.stubEnv("KNOWVIA_API_URL", "http://api.test");
  vi.stubEnv("KNOWVIA_BOOTSTRAP_TOKEN", "bootstrap-token-should-never-be-used-here");
});
afterEach(() => vi.unstubAllEnvs());

describe("secure-flag decision", () => {
  it.each([
    [{ host: "app.knowvia.test" }, true],
    [{ host: "app.knowvia.test", forwardedProto: "http" }, true],
    [{ host: "localhost:3000" }, false],
    [{ host: "127.0.0.1:3000" }, false],
    [{ host: "[::1]:3000" }, false],
    [{ host: "dev.localhost:3000" }, false],
    [{ host: "localhost:3000", forwardedProto: "https" }, true],
    [{ host: "localhost.evil.test" }, true],
    [{ host: "evil.test:3000, localhost" }, true],
    [{ host: null }, true],
    [{}, true],
  ])("%j -> secure %s", (input, secure) => {
    expect(isSecureRequest(input)).toBe(secure);
  });

  it("does not depend on NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isSecureRequest({ host: "app.knowvia.test" })).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(isSecureRequest({ host: "localhost:3000" })).toBe(false);
  });
});

describe("session Set-Cookie flags", () => {
  it("sets Secure, HttpOnly, SameSite=Lax, Path=/ and a bounded Max-Age on a real host", async () => {
    await writeSession(payload(Date.now() + 3_600_000), A);
    const line = last(SESS);
    expect(has(line, "Secure")).toBe(true);
    expect(has(line, "HttpOnly")).toBe(true);
    expect(attr(line, "SameSite")).toBe("lax");
    expect(attr(line, "Path")).toBe("/");
    expect(Number(attr(line, "Max-Age"))).toBeGreaterThan(3_590);
    expect(Number(attr(line, "Max-Age"))).toBeLessThanOrEqual(3_600);
    expect(attr(line, "Domain")).toBeUndefined();
  });

  it("is Secure even when NODE_ENV is not production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await writeSession(payload(), A);
    expect(has(last(SESS), "Secure")).toBe(true);
  });

  it("drops Secure only for plain-http loopback", async () => {
    reqHeaders = { host: "localhost:3000" };
    await writeSession(payload(), A);
    const line = last("kv_session");
    expect(has(line, "Secure")).toBe(false);
    expect(has(line, "HttpOnly")).toBe(true);
    expect(attr(line, "SameSite")).toBe("lax");
  });

  it("fails closed to Secure when the request headers are unavailable", async () => {
    reqHeaders = {};
    await writeSession(payload(), A);
    expect(has(last(SESS), "Secure")).toBe(true);
  });

  it("caps Max-Age and the sealed expiry at 7 days whatever the backend says", async () => {
    await writeSession(payload(Date.now() + 90 * 86_400_000), A);
    const line = last(SESS);
    expect(Number(attr(line, "Max-Age"))).toBeLessThanOrEqual(7 * 86_400);
    expect(Number(attr(line, "Max-Age"))).toBeGreaterThan(7 * 86_400 - 5);
    expect(open(valueOf(line), A)?.exp).toBeLessThanOrEqual(Date.now() + MAX_SESSION_MS);
  });

  it("never sets Max-Age below 60 seconds", () => {
    expect(sessionMaxAgeSeconds(Date.now() + 5_000)).toBe(60);
    expect(sessionMaxAgeSeconds(Date.now() - 5_000)).toBe(60);
  });

  it("clears with the same attributes, empty value, Max-Age=0 and an epoch Expires", async () => {
    await clearSession();
    const line = last(SESS);
    expect(valueOf(line)).toBe("");
    expect(attr(line, "Max-Age")).toBe("0");
    expect(new Date(attr(line, "Expires") as string).getTime()).toBe(0);
    expect(has(line, "Secure")).toBe(true);
    expect(has(line, "HttpOnly")).toBe(true);
    expect(attr(line, "SameSite")).toBe("lax");
    expect(attr(line, "Path")).toBe("/");
  });

  it("holds no plaintext token or household id", async () => {
    await writeSession(payload(), A);
    const v = valueOf(last(SESS));
    const [kid, iv, tag, ct] = v.split(".") as [string, string, string, string];
    for (const part of [kid, iv, tag, ct]) {
      const decoded = Buffer.from(part, "base64url").toString("utf8");
      expect(decoded).not.toContain("tok");
      expect(decoded).not.toContain("h1");
      expect(decoded).not.toContain("m1");
    }
    expect(v).not.toContain(A);
    expect(unseal(v, B)).toBeNull(); // opaque without the key
    expect(unseal(v, A)?.payload.t).toBe("tok");
  });
});

describe("two-key rotation", () => {
  it("round-trips with the current key and carries a kid, not the secret", () => {
    const s = seal(payload(), A);
    expect(s.split(".")).toHaveLength(4);
    expect(s.startsWith(`${keyId(A)}.`)).toBe(true);
    expect(s).not.toContain(A);
    expect(open(s, A)).toEqual(expect.objectContaining({ h: "h1" }));
    expect(keyId(A)).not.toBe(keyId(B));
  });

  it("accepts a cookie sealed with the previous key and flags it for re-seal", () => {
    const old = seal(payload(), B);
    expect(unseal(old, A, { previous: B })?.reseal).toBe(true);
    expect(open(old, A, { previous: B })?.h).toBe("h1");
    expect(unseal(seal(payload(), A), A, { previous: B })?.reseal).toBe(false);
  });

  it("rejects a key that is neither current nor previous", () => {
    expect(open(seal(payload(), C), A, { previous: B })).toBeNull();
    expect(open(seal(payload(), B), A)).toBeNull();
  });

  it("readSession re-seals a previous-key cookie with the current key, keeping the same expiry", async () => {
    vi.stubEnv("SESSION_COOKIE_SECRET_PREVIOUS", B);
    const p = payload();
    inbound.set(SESS, seal(p, B));
    expect((await readSession(A))?.exp).toBe(p.exp);
    const line = last(SESS);
    expect(valueOf(line).startsWith(`${keyId(A)}.`)).toBe(true);
    expect(open(valueOf(line), A)?.exp).toBe(p.exp);
    expect(open(valueOf(line), B)).toBeNull(); // really re-sealed under the current key
    expect(has(line, "Secure")).toBe(true);
    expect(has(line, "HttpOnly")).toBe(true);
  });

  it("does not re-seal a current cookie", async () => {
    inbound.set(SESS, seal(payload(), A));
    expect(await readSession(A)).not.toBeNull();
    expect(setCookies(SESS)).toHaveLength(0);
  });

  it("rejects the previous key once SESSION_COOKIE_SECRET_PREVIOUS is removed", async () => {
    inbound.set(SESS, seal(payload(), B));
    expect(await readSession(A)).toBeNull();
  });

  it("ignores a weak or identical previous secret", () => {
    expect(previousCookieSecret({ SESSION_COOKIE_SECRET: A, SESSION_COOKIE_SECRET_PREVIOUS: "short" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(previousCookieSecret({ SESSION_COOKIE_SECRET: A, SESSION_COOKIE_SECRET_PREVIOUS: A } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(previousCookieSecret({ SESSION_COOKIE_SECRET: A, SESSION_COOKIE_SECRET_PREVIOUS: B } as unknown as NodeJS.ProcessEnv)).toBe(B);
  });
});

describe("legacy kid-less cookies (transition)", () => {
  it("accepts one with the current key and re-seals it in the new format", async () => {
    const p = payload();
    inbound.set(SESS, sealLegacy(p, A));
    expect((await readSession(A))?.h).toBe("h1");
    const resealed = valueOf(last(SESS));
    expect(resealed.split(".")).toHaveLength(4);
    expect(open(resealed, A)?.exp).toBe(p.exp);
  });

  it("never accepts a legacy cookie under the previous key", () => {
    expect(open(sealLegacy(payload(), B), A, { previous: B })).toBeNull();
  });

  it("is refused once the transition is closed", () => {
    expect(open(sealLegacy(payload(), A), A, { acceptLegacy: false })).toBeNull();
  });
});

describe("rotation edge cases", () => {
  it("rejects a legacy 3-part cookie sealed with the previous key even when a previous secret is configured", async () => {
    vi.stubEnv("SESSION_COOKIE_SECRET_PREVIOUS", B);
    inbound.set(SESS, sealLegacy(payload(), B));
    expect(await readSession(A)).toBeNull();
    expect(setCookies(SESS)).toHaveLength(0);
  });
  it("rejects a kid that names the current key but was sealed with another", () => {
    const s = seal(payload(), B).split(".");
    s[0] = keyId(A);
    expect(open(s.join("."), A, { previous: B })).toBeNull();
    const t = seal(payload(), A).split(".");
    t[0] = keyId(B);
    expect(open(t.join("."), A, { previous: B })).toBeNull(); // kid says previous, bytes are current
  });
  it("rejects a kid naming an unknown key", () => {
    const s = seal(payload(), A).split(".");
    s[0] = keyId(C);
    expect(open(s.join("."), A, { previous: B })).toBeNull();
  });
});

describe("cookie name prefixes", () => {
  it("uses __Host- for the session and __Secure- for oauth when Secure, plain names otherwise", () => {
    expect(sessionCookieName(true)).toBe("__Host-kv_session");
    expect(sessionCookieName(false)).toBe("kv_session");
    expect(oauthCookieName(true)).toBe("__Secure-kv_oauth");
    expect(oauthCookieName(false)).toBe("kv_oauth");
  });
  it("the __Host- session cookie meets the prefix rules: Secure, Path=/, no Domain", async () => {
    await writeSession(payload(), A);
    const line = last("__Host-kv_session");
    expect(has(line, "Secure")).toBe(true);
    expect(attr(line, "Path")).toBe("/");
    expect(attr(line, "Domain")).toBeUndefined();
  });
  it("loopback http uses the plain name and sets no prefixed cookie", async () => {
    reqHeaders = { host: "localhost:3000" };
    await writeSession(payload(), A);
    expect(setCookies("kv_session")).toHaveLength(1);
    expect(setCookies("__Host-kv_session")).toHaveLength(0);
    inbound.set("kv_session", seal(payload(), A));
    expect(await readSession(A)).not.toBeNull();
  });
  it("sign-out clears the prefixed cookie and any old plain one with the same flags", async () => {
    await clearSession();
    for (const n of ["__Host-kv_session", "kv_session"]) {
      const line = last(n);
      expect(attr(line, "Max-Age")).toBe("0");
      expect(has(line, "Secure")).toBe(true);
      expect(has(line, "HttpOnly")).toBe(true);
      expect(attr(line, "Path")).toBe("/");
    }
  });
  it("writing a session also removes a lingering plain cookie", async () => {
    await writeSession(payload(), A);
    expect(attr(last("kv_session"), "Max-Age")).toBe("0");
  });
  it("reads an old plain kv_session once, re-seals it under the new name and clears the old one", async () => {
    const p = payload();
    inbound.set("kv_session", seal(p, A));
    expect((await readSession(A))?.exp).toBe(p.exp);
    expect(open(valueOf(last("__Host-kv_session")), A)?.exp).toBe(p.exp);
    const old = last("kv_session");
    expect(valueOf(old)).toBe("");
    expect(attr(old, "Max-Age")).toBe("0");
  });
  it("does not read the plain cookie once the legacy transition is closed", async () => {
    vi.stubEnv("SESSION_COOKIE_ACCEPT_LEGACY", "0");
    inbound.set("kv_session", seal(payload(), A));
    expect(await readSession(A)).toBeNull();
    expect(setCookies(SESS)).toHaveLength(0);
  });
  it("a valid prefixed cookie wins over a stale plain one and nothing is re-set", async () => {
    inbound.set(SESS, seal(payload(), A));
    inbound.set("kv_session", seal({ ...payload(), h: "other" }, A));
    expect((await readSession(A))?.h).toBe("h1");
    expect(setCookies(SESS)).toHaveLength(0);
  });
});

describe("COOKIE_SECURE and deploy overrides", () => {
  const loopback = { host: "localhost:3000" };
  it("COOKIE_SECURE=always never drops Secure, even on loopback http", async () => {
    vi.stubEnv("COOKIE_SECURE", "always");
    expect(isSecureRequest(loopback)).toBe(true);
    reqHeaders = loopback;
    await writeSession(payload(), A);
    expect(has(last(SESS), "Secure")).toBe(true);
  });
  it("never drops Secure on Vercel or with an https APP_ORIGIN", () => {
    vi.stubEnv("VERCEL", "1");
    expect(isSecureRequest(loopback)).toBe(true);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("APP_ORIGIN", "https://app.knowvia.test");
    expect(isSecureRequest(loopback)).toBe(true);
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    expect(isSecureRequest(loopback)).toBe(false);
  });
  it("any other COOKIE_SECURE value does not force Secure", () => {
    vi.stubEnv("COOKIE_SECURE", "never");
    expect(isSecureRequest(loopback)).toBe(false);
  });
});

describe("tamper and expiry fail closed", () => {
  const flip = (s: string, i: number) => {
    const parts = s.split(".");
    const p = parts[i] as string;
    parts[i] = (p[0] === "A" ? "B" : "A") + p.slice(1);
    return parts.join(".");
  };
  it.each([0, 1, 2, 3])("rejects a change to part %i", (i) => {
    expect(open(flip(seal(payload(), A), i), A, { previous: B })).toBeNull();
  });
  it("rejects a swapped kid (bound as authenticated data)", () => {
    const s = seal(payload(), B).split(".");
    s[0] = keyId(A);
    expect(open(s.join("."), A, { previous: B })).toBeNull();
  });
  it("rejects expired, far-future, malformed, oversized and empty values", () => {
    expect(open(seal(payload(Date.now() - 1), A), A)).toBeNull();
    expect(open(seal(payload(Date.now() + 30 * 86_400_000), A), A)).toBeNull();
    expect(open("garbage", A)).toBeNull();
    expect(open("a.b.c.d.e", A)).toBeNull();
    expect(open("x".repeat(5000), A)).toBeNull();
    expect(open("", A)).toBeNull();
    expect(open(undefined, A)).toBeNull();
  });
  it("rejects an expiry that passes between seal and open", () => {
    const s = seal(payload(Date.now() + 1_000), A);
    expect(open(s, A, { now: Date.now() + 2_000 })).toBeNull();
  });
});

describe("Google transient cookie flags", () => {
  const at = (path: string, host = "app.knowvia.test", extra: Record<string, string> = {}) => new Request(`https://${host}${path}`, { headers: { host, ...extra } });
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN", "1");
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id.apps.test");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
    vi.stubEnv("KNOWVIA_IDENTITY_TOKEN", "identity-token-0123456789-0123456789-abcdef");
    vi.stubEnv("APP_ORIGIN", "https://app.knowvia.test");
  });

  it("sets state/nonce/verifier cookie Secure, HttpOnly, Lax, scoped path, 600s", async () => {
    await start.GET(at("/api/app/auth/google"));
    const line = last(OAUTH);
    expect(has(line, "Secure")).toBe(true);
    expect(has(line, "HttpOnly")).toBe(true);
    expect(attr(line, "SameSite")).toBe("lax");
    expect(attr(line, "Path")).toBe("/api/app/auth/google");
    expect(attr(line, "Max-Age")).toBe("600");
    expect(attr(line, "Domain")).toBeUndefined();
    expect(line).not.toContain("google-secret");
  });

  it("drops Secure only on plain-http loopback", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    await start.GET(new Request("http://localhost:3000/api/app/auth/google", { headers: { host: "localhost:3000" } }));
    const line = last("kv_oauth");
    expect(has(line, "Secure")).toBe(false);
    expect(has(line, "HttpOnly")).toBe(true);
  });

  it("is cleared with identical attributes on every callback, success or not", async () => {
    await start.GET(at("/api/app/auth/google"));
    await callback.GET(at("/api/app/auth/google/callback?error=access_denied"));
    const line = last(OAUTH);
    expect(valueOf(line)).toBe("");
    expect(attr(line, "Max-Age")).toBe("0");
    expect(new Date(attr(line, "Expires") as string).getTime()).toBe(0);
    expect(has(line, "Secure")).toBe(true);
    expect(has(line, "HttpOnly")).toBe(true);
    expect(attr(line, "SameSite")).toBe("lax");
    expect(attr(line, "Path")).toBe("/api/app/auth/google");
  });

  it("flag off: callback makes no backend call, still clears the oauth cookie, and sets no session", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await callback.GET(at("/api/app/auth/google/callback?code=abc&state=zzz"));
    expect(res.headers.get("location")).toBe("/signin?error=google_unavailable");
    expect(fetchSpy).not.toHaveBeenCalled();
    const line = last(OAUTH);
    expect(valueOf(line)).toBe("");
    expect(attr(line, "Max-Age")).toBe("0");
    expect(setCookies(SESS)).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("sets no cookie when the feature flag is off (production default)", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN", "");
    const res = await start.GET(at("/api/app/auth/google"));
    expect(res.headers.get("location")).toBe("/signin?error=google_unavailable");
    expect(setCookies(OAUTH)).toHaveLength(0);
  });
});
