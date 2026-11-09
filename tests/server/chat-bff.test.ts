import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/server/backend/session";

const SECRET = "s".repeat(40);
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined), set: () => {}, delete: () => {} }), headers: async () => ({ get: () => null }) }));

import { POST } from "@/app/api/app/chat/route";

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
let calls: Call[];
let reply: { status: number; body: unknown } | "throw";

const req = (body: unknown, extra: Record<string, string> = {}) => {
  const raw = JSON.stringify(body);
  return new Request("http://app.test/api/app/chat", { method: "POST", headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "application/json", "content-length": String(new TextEncoder().encode(raw).length), ...extra }, body: raw });
};
const GOOD = { reply: "Covered up to Rs 40,000.", steps: ["a", "b", "c"], answerStatus: "evidence_found", sources: [{ tier: "household_evidence", label: "Policy", page: 14, quote: "up to Rs 40,000" }], contextOnly: true, evil: "x" };

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  cookieValue = seal({ t: "tok-123456789012345", h: "h 1", m: "m1", exp: Date.now() + 60_000 }, SECRET);
  calls = [];
  reply = { status: 200, body: GOOD };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
    if (reply === "throw") throw new Error("boom http://secret");
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("chat BFF", () => {
  it("proxies with the bearer token, maps the body and allow-lists the answer", async () => {
    const res = await POST(req({ text: " Is cataract covered? ", page: "/home" }));
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toBe("http://backend.test/api/v1/households/h%201/chat");
    expect(calls[0]?.headers.authorization).toBe("Bearer tok-123456789012345");
    expect(calls[0]?.body).toEqual({ message: "Is cataract covered?", page: "/home" });
    const body = await res.json();
    expect(body.answerStatus).toBe("evidence_found");
    expect(body.sources[0].page).toBe(14);
    expect(body.evil).toBeUndefined();
  });
  it("refuses a demo session with DEMO_READ_ONLY and never calls the backend", async () => {
    cookieValue = seal({ t: "", h: "demo", m: "m", exp: Date.now() + 60_000, demo: true }, SECRET);
    vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
    const res = await POST(req({ text: "hi" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("DEMO_READ_ONLY");
    expect(calls).toHaveLength(0);
    vi.unstubAllEnvs();
  });
  it("needs a session, the app header and a valid body", async () => {
    expect((await POST(req({ text: "x" }, { "x-knowvia-app": "0" }))).status).toBe(403);
    expect((await POST(req({ text: "" }))).status).toBe(400);
    expect((await POST(req({ text: "x".repeat(501) }))).status).toBe(400);
    expect((await POST(req({ text: "x", page: "https://evil" }))).status).toBe(400);
    cookieValue = undefined;
    expect((await POST(req({ text: "x" }))).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("maps backend errors to client-safe codes without echoing the message", async () => {
    reply = { status: 503, body: { error: { code: "CHAT_NOT_CONFIGURED", message: "secret text" } } };
    let res = await POST(req({ text: "private question" }));
    expect(res.status).toBe(503);
    const raw = JSON.stringify(await res.json());
    expect(raw).toContain("CHAT_NOT_CONFIGURED");
    expect(raw).not.toContain("private question");
    expect(raw).not.toContain("secret text");
    reply = { status: 429, body: {} };
    res = await POST(req({ text: "x" }));
    expect(res.status).toBe(429);
    reply = { status: 400, body: { error: { code: "CHAT_REQUEST_INVALID" } } };
    expect((await POST(req({ text: "x" }))).status).toBe(400);
    reply = { status: 401, body: {} };
    expect((await POST(req({ text: "x" }))).status).toBe(401);
    reply = { status: 500, body: {} };
    expect((await POST(req({ text: "x" }))).status).toBe(502);
    reply = { status: 200, body: { nope: 1 } };
    expect((await (await POST(req({ text: "x" }))).json()).code).toBe("BACKEND_BAD_RESPONSE");
    reply = "throw";
    const r = await POST(req({ text: "x" }));
    expect(JSON.stringify(await r.json())).not.toContain("secret");
  });
  it("caps the body at 4 KB, needs application/json and a Content-Length", async () => {
    const big = await POST(req({ text: "x", pad: "y".repeat(5000) }));
    expect(big.status).toBe(413);
    expect((await POST(req({ text: "x" }, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(req({ text: "x" }, { "content-length": "abc" }))).status).toBe(411);
    const noLen = await POST(new Request("http://app.test/api/app/chat", {
      method: "POST", duplex: "half", headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "application/json" },
      body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"text":"x"}')); c.close(); } }),
    } as RequestInit));
    expect(noLen.status).toBe(411);
    // a body that lies about its size is cut off while streaming
    const lying = new Request("http://app.test/api/app/chat", {
      method: "POST", duplex: "half", headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "application/json", "content-length": "10" },
      body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(9000)); c.close(); } }),
    } as RequestInit);
    expect((await POST(lying)).status).toBe(413);
    expect(calls).toHaveLength(0);
  });
  it("does not retry the non-idempotent chat POST, and sends an abort signal", async () => {
    const signals: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { calls.push({ url, headers: {}, body: {} }); signals.push(init.signal); return new Response("{}", { status: 500 }); });
    expect((await POST(req({ text: "x" }))).status).toBe(502);
    expect(calls).toHaveLength(1); // guardedFetch is a bulkhead plus breaker: it never retries
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });
});
