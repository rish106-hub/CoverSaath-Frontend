import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

let out = NextResponse.next();
const inbound = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (inbound.has(n) ? { value: inbound.get(n) as string } : undefined),
    set: (n: string, v: string, o?: Record<string, unknown>) => void out.cookies.set(n, v, o),
  }),
  headers: async () => ({ get: (n: string) => ({ host: "localhost:3200" })[n.toLowerCase()] ?? null }),
}));

import { POST as demoLogin } from "@/app/api/app/demo/route";
import { POST as signout } from "@/app/api/app/signout/route";
import { GET as me } from "@/app/api/app/me/route";
import { GET as placesGet } from "@/app/api/app/places/route";
import { readSession, readAnySession } from "@/server/backend";
import { seal } from "@/server/backend/session";
import { demoResetLimits } from "@/server/backend/demo";

const SECRET = "s".repeat(40);
const req = (body: unknown) =>
  new Request("http://localhost:3200/api/app/demo", {
    method: "POST",
    headers: { "content-type": "application/json", "x-knowvia-app": "1", host: "localhost:3200", origin: "http://localhost:3200" },
    body: JSON.stringify(body),
  });
const GOOD = { email: "demo@demo.com", password: "demo123" };
const setCookie = (name: string) => out.headers.getSetCookie().filter((l) => l.startsWith(`${name}=`));

beforeEach(() => {
  out = NextResponse.next();
  inbound.clear();
  demoResetLimits();
  vi.stubEnv("KNOWVIA_API_URL", "http://127.0.0.1:1");
  vi.stubEnv("KNOWVIA_BOOTSTRAP_TOKEN", "b".repeat(40));
  vi.stubEnv("SESSION_COOKIE_SECRET", SECRET);
  vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("demo login", () => {
  it("is off by default", async () => {
    vi.stubEnv("DEMO_LOGIN_ENABLED", "");
    const res = await demoLogin(req(GOOD));
    expect(res.status).toBe(404);
    expect(setCookie("kv_session")).toHaveLength(0);
    vi.stubEnv("DEMO_LOGIN_ENABLED", "1");
    expect((await demoLogin(req(GOOD))).status).toBe(404);
  });

  it("rejects a wrong password and a wrong email", async () => {
    expect((await demoLogin(req({ email: "demo@demo.com", password: "nope" }))).status).toBe(401);
    expect((await demoLogin(req({ email: "x@demo.com", password: "demo123" }))).status).toBe(401);
    expect((await demoLogin(req(null))).status).toBe(401);
    expect(setCookie("kv_session")).toHaveLength(0);
    expect(setCookie("kv_demo").filter((c) => c.includes("kv_demo=1"))).toHaveLength(0);
  });

  it("rate limits repeated failures", async () => {
    for (let i = 0; i < 8; i++) await demoLogin(req({ email: "a", password: "b" }));
    expect((await demoLogin(req(GOOD))).status).toBe(429);
  });

  it("refuses a cross-origin call", async () => {
    const r = new Request("http://localhost:3200/api/app/demo", { method: "POST", headers: { "x-knowvia-app": "1", host: "localhost:3200", origin: "https://evil.example" }, body: JSON.stringify(GOOD) });
    expect((await demoLogin(r)).status).toBe(403);
  });

  it("correct credentials set the demo session and marker, with no backend call", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("backend must not be called")));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await demoLogin(req(GOOD));
    expect(res.status).toBe(200);
    expect(setCookie("kv_session")).toHaveLength(1);
    expect(setCookie("kv_session")[0]).toMatch(/HttpOnly/i);
    expect(setCookie("kv_demo")[0]).toContain("kv_demo=1");
    expect(fetchSpy).not.toHaveBeenCalled();
    // the sealed cookie really is a demo session
    inbound.set("kv_session", setCookie("kv_session")[0]!.split(";")[0]!.split("=")[1]!);
    const s = await readAnySession(SECRET);
    expect(s?.demo).toBe(true);
    expect(s?.t).toBe("");
  });

  it("a demo session cannot reach the backend: readSession and data routes refuse it", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("backend must not be called")));
    vi.stubGlobal("fetch", fetchSpy);
    inbound.set("kv_session", seal({ t: "", h: "demo", m: "demo", exp: Date.now() + 3_600_000, demo: true }, SECRET));
    await expect(readSession(SECRET)).rejects.toMatchObject({ status: 403, code: "DEMO_READ_ONLY" });
    const r = await placesGet(new Request("http://localhost:3200/api/app/places", { headers: { host: "localhost:3200" } }));
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ ok: false, code: "DEMO_READ_ONLY" });
    const m = await me();
    expect(m.status).toBe(200);
    expect(await m.json()).toMatchObject({ demo: true, source: "mock" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sign-out clears a demo session without calling the backend", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("backend must not be called")));
    vi.stubGlobal("fetch", fetchSpy);
    inbound.set("kv_session", seal({ t: "", h: "demo", m: "demo", exp: Date.now() + 3_600_000, demo: true }, SECRET));
    const res = await signout(req({}));
    expect(res.status).toBe(200);
    expect(setCookie("kv_session")[0]).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect(setCookie("kv_demo")[0]).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("non-demo sessions are unchanged: readSession returns them and writes no demo marker", async () => {
    inbound.set("kv_session", seal({ t: "tok", h: "h1", m: "m1", exp: Date.now() + 3_600_000 }, SECRET));
    expect(await readSession(SECRET)).toMatchObject({ t: "tok", h: "h1" });
    expect((await readSession(SECRET))?.demo).toBeUndefined();
    const { writeSession } = await import("@/server/backend");
    await writeSession({ t: "tok", h: "h1", m: "m1", exp: Date.now() + 3_600_000 }, SECRET);
    expect(setCookie("kv_demo").every((c) => !c.includes("kv_demo=1"))).toBe(true);
  });
});
