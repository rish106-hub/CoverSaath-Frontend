import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/server/backend/session";

const SECRET = "s".repeat(40);
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined), set: () => {}, delete: () => {} }), headers: async () => ({ get: () => null }) }));

import { GET } from "@/app/api/app/reference/products/route";

type Call = { url: string; headers: Record<string, string>; method: string };
let calls: Call[];
let reply: { status: number; body: unknown } | "throw";

const req = (qs: string, extra: Record<string, string> = {}) => new Request(`http://app.test/api/app/reference/products${qs}`, { method: "GET", headers: { host: "app.test", ...extra } });
const PRODUCT = { productId: "prod_example_01", insurerId: "ins_example_1", productName: "Example Health Plan 01", lineOfBusiness: "health", uinRaw: "SYNTHETIC-TEST-ONLY/01", verificationStatus: "synthetic_test", dataCoverage: "not_observed", lastObservedAt: "2026-01-01T00:00:00.000Z", internalNote: "x" };
const GOOD = { products: [PRODUCT], ambiguous: false, source: "cache", fetchedAt: "2026-01-01T00:00:00.000Z", referenceContextOnly: true, evil: "x" };

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  cookieValue = seal({ t: "tok-123456789012345", h: "h1", m: "m1", exp: Date.now() + 60_000 }, SECRET);
  calls = [];
  reply = { status: 200, body: GOOD };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, method: init.method as string });
    if (reply === "throw") throw new Error("boom http://secret");
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("reference products BFF", () => {
  it("proxies with the bearer token, no household id, and allow-lists the answer", async () => {
    const res = await GET(req("?uin=SYNTHETIC-TEST-ONLY%2F01"));
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toBe("http://backend.test/api/v1/reference/products?uin=SYNTHETIC-TEST-ONLY%2F01");
    expect(calls[0]?.url).not.toContain("h1");
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.headers.authorization).toBe("Bearer tok-123456789012345");
    const body = await res.json();
    expect(body.products[0].productId).toBe("prod_example_01");
    expect(body.products[0].internalNote).toBeUndefined();
    expect(body.evil).toBeUndefined();
    expect(body.source).toBeUndefined();
  });
  it("refuses a demo session with DEMO_READ_ONLY and never calls the backend", async () => {
    cookieValue = seal({ t: "", h: "demo", m: "m", exp: Date.now() + 60_000, demo: true }, SECRET);
    vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
    const res = await GET(req("?q=plan"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("DEMO_READ_ONLY");
    expect(calls).toHaveLength(0);
    vi.unstubAllEnvs();
  });
  it("needs a session", async () => {
    cookieValue = undefined;
    expect((await GET(req("?q=plan"))).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("rejects bad queries before any backend call", async () => {
    for (const qs of ["", "?q=", "?q=a&q=b", "?q=a&uin=b", "?householdId=h1", "?q=a&limit=5", "?insurerId=has%20space", "?q=bad%00text", `?q=${"x".repeat(101)}`]) {
      const res = await GET(req(qs));
      expect(res.status, qs).toBe(400);
      expect((await res.json()).code).toBe("INVALID_INPUT");
    }
    expect(calls).toHaveLength(0);
  });
  it("maps 503 not-configured (and stale) to REFERENCE_UNAVAILABLE without echoing backend text", async () => {
    reply = { status: 503, body: { error: { code: "REFERENCE_DATA_NOT_CONFIGURED", message: "secret backend text" } } };
    const res = await GET(req("?q=plan"));
    expect(res.status).toBe(503);
    const raw = JSON.stringify(await res.json());
    expect(raw).toContain("REFERENCE_UNAVAILABLE");
    expect(raw).not.toContain("secret backend text");
    expect(raw).not.toContain("REFERENCE_DATA");
  });
  it("maps other backend failures to client-safe codes", async () => {
    reply = { status: 429, body: {} };
    expect((await GET(req("?q=plan"))).status).toBe(429);
    reply = { status: 400, body: { error: { code: "REFERENCE_DATA_REQUEST_INVALID", message: "leak" } } };
    const bad = await GET(req("?q=plan"));
    expect(bad.status).toBe(400);
    expect(JSON.stringify(await bad.json())).not.toContain("leak");
    reply = { status: 401, body: {} };
    expect((await GET(req("?q=plan"))).status).toBe(401);
    reply = { status: 500, body: { error: { message: "stack trace" } } };
    const r500 = await GET(req("?q=plan"));
    expect(r500.status).toBe(502);
    expect(JSON.stringify(await r500.json())).not.toContain("stack trace");
    reply = "throw";
    const down = await GET(req("?q=plan"));
    expect(down.status).toBe(503);
    expect(JSON.stringify(await down.json())).not.toContain("secret");
  });
  it("a response that fails the schema is BACKEND_BAD_RESPONSE", async () => {
    for (const body of [{ products: "no" }, { ...GOOD, referenceContextOnly: false }, { ...GOOD, products: [{ ...PRODUCT, verificationStatus: "nope" }] }, [], null]) {
      reply = { status: 200, body };
      const res = await GET(req("?q=plan"));
      expect(res.status).toBe(502);
      expect((await res.json()).code).toBe("BACKEND_BAD_RESPONSE");
    }
  });
});
