import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/server/backend/session";

const SECRET = "s".repeat(40);
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => ({ host: "app.test" })[n.toLowerCase()] ?? null }),
  cookies: async () => ({ get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined), set: (n: string, v: string) => void jar.set(n, v), delete: (n: string) => void jar.delete(n) }),
}));

import * as threads from "@/app/api/app/chat/threads/route";
import * as turns from "@/app/api/app/chat/threads/[id]/turns/route";
import * as hospitals from "@/app/api/app/covers/holdings/[id]/hospitals/route";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
let calls: Call[];
let sse: string[] | null;
let jsonReply: { status: number; body: unknown };
const FAKE_UIN = "SYNTH00001V010101";

const frame = (e: string, d: unknown) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
const ANSWER = { turn_id: "t1", status: "evidence_found", intent: "waiting_period", answer: "Thirty days.", answer_source: "deterministic", model_status: "x", audio_retained: false, created_at: "now",
  facts_used: [{ fact_id: "f1", fact_key: "initial_waiting_days", label: "Initial waiting", status: "reviewed_reference", source_tier: "ida_wording", value_text: "30 days", holding_id: "h-1", check_with_insurer: true, uin: "leak" }],
  computed: null, open_conflicts: [{ conflict_id: "c1", fact_key: "room_rent_limit", holding_id: "h-1" }] };

const req = (path: string, method: string, o: { json?: unknown; marker?: boolean } = {}) => {
  const raw = o.json === undefined ? undefined : JSON.stringify(o.json);
  return new Request(`http://app.test${path}`, { method, headers: { host: "app.test", ...(o.marker === false ? {} : { "x-knowvia-app": "1" }), ...(raw ? { "content-type": "application/json", "content-length": String(new TextEncoder().encode(raw).length) } : { "content-length": "0" }) }, body: raw });
};
const P = (id: string) => ({ params: Promise.resolve({ id }) });
const streamOf = (chunks: string[]) => new ReadableStream<Uint8Array>({ start(c) { for (const k of chunks) c.enqueue(new TextEncoder().encode(k)); c.close(); } });

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  jar.clear();
  jar.set("kv_session", seal({ t: "tok-secret", h: "h1", m: "m1", a: "adult1", exp: Date.now() + 60_000 }, SECRET));
  calls = [];
  sse = null;
  jsonReply = { status: 200, body: {} };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const u = new URL(url);
    calls.push({ url: u.pathname + u.search, method: init.method ?? "GET", headers: init.headers as Record<string, string>, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
    if (sse && u.pathname.endsWith("/turns")) return new Response(streamOf(sse), { status: 200, headers: { "content-type": "text/event-stream" } });
    return new Response(JSON.stringify(jsonReply.body), { status: jsonReply.status });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("chat threads", () => {
  it("opens a thread with the household from the session, never from the page", async () => {
    jsonReply = { status: 201, body: { thread: { id: "th-1", household_id: "h1", holding_id: "hold-1", created_at: "now" } } };
    const res = await threads.POST(req("/api/app/chat/threads", "POST", { json: { holdingId: "hold-1" } }));
    expect(res.status).toBe(201);
    expect((await res.json()).data).toEqual({ id: "th-1", holdingId: "hold-1" });
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/v1/chat/threads", body: { household_id: "h1", holding_id: "hold-1" } });
    expect(calls[0]?.headers.authorization).toBe("Bearer tok-secret");
  });
  it("refuses a page-supplied household and a bad holding id", async () => {
    expect((await threads.POST(req("/x", "POST", { json: { householdId: "other" } }))).status).toBe(400);
    expect((await threads.POST(req("/x", "POST", { json: { holdingId: "../x" } }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("needs a session and the app marker", async () => {
    expect((await threads.POST(req("/x", "POST", { json: {}, marker: false }))).status).toBe(403);
    jar.delete("kv_session");
    expect((await threads.POST(req("/x", "POST", { json: {} }))).status).toBe(401);
  });
  it("codes MEMORY_DISABLED without leaking the backend message", async () => {
    jsonReply = { status: 503, body: { error: { code: "MEMORY_DISABLED", message: "backend words" } } };
    const res = await threads.POST(req("/x", "POST", { json: {} }));
    expect(res.status).toBe(503);
    const t = await res.text();
    expect(JSON.parse(t).code).toBe("MEMORY_DISABLED");
    expect(t).not.toContain("backend words");
  });
});

describe("chat turns (SSE pass-through)", () => {
  it("streams allow-listed camelCase events, even when a frame is split across chunks, and drops unknown keys", async () => {
    const all = frame("meta", { thread_id: "th-1", intent: "waiting_period", retrieval_mode: "facts_only", facts_available: 3, open_conflicts: 1, secret: "x" }) + frame("delta", { text: "Thirty " }) + frame("answer", ANSWER) + frame("done", {});
    sse = [all.slice(0, 40), all.slice(40, 200), all.slice(200)];
    const res = await turns.POST(req("/x", "POST", { json: { message: " Waiting? ", inputKind: "voice" } }), P("th-1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text.indexOf("event: meta")).toBeLessThan(text.indexOf("event: delta"));
    expect(text.indexOf("event: delta")).toBeLessThan(text.indexOf("event: answer"));
    expect(text.trimEnd().endsWith("event: done\ndata: {}")).toBe(true);
    expect(text).toContain('"turnId":"t1"');
    expect(text).toContain('"checkWithInsurer":true');
    expect(text).not.toMatch(/leak|secret|model_status|audio_retained|holding_id|"uin"/);
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/v1/chat/threads/th-1/turns", body: { message: "Waiting?", input_kind: "voice" } });
    expect(calls[0]?.headers.authorization).toBe("Bearer tok-secret");
  });
  it("ends with one coded error event when an event carries a UIN", async () => {
    sse = [frame("meta", { thread_id: "th-1", intent: "x", retrieval_mode: "keyword" }), frame("answer", { ...ANSWER, answer: `Plan ${FAKE_UIN}` }), frame("done", {})];
    const text = await (await turns.POST(req("/x", "POST", { json: { message: "hi" } }), P("th-1"))).text();
    expect(text).not.toContain(FAKE_UIN);
    expect(text).toContain('event: error\ndata: {"code":"CHAT_STREAM_FAILED"}');
    expect(text).not.toContain("event: done");
  });
  it("ends with a coded error when the backend closes without done, or sends an unknown event", async () => {
    sse = [frame("meta", { thread_id: "th-1", intent: "x", retrieval_mode: "keyword" })];
    expect(await (await turns.POST(req("/x", "POST", { json: { message: "hi" } }), P("th-1"))).text()).toContain("CHAT_STREAM_FAILED");
    sse = [frame("surprise", {})];
    expect(await (await turns.POST(req("/x", "POST", { json: { message: "hi" } }), P("th-1"))).text()).toContain("CHAT_STREAM_FAILED");
  });
  it("passes a backend error event through as a code only", async () => {
    sse = [frame("meta", { thread_id: "th-1", intent: "x", retrieval_mode: "keyword" }), frame("error", { code: "CHAT_MODEL_FAILED", detail: "no" })];
    const text = await (await turns.POST(req("/x", "POST", { json: { message: "hi" } }), P("th-1"))).text();
    expect(text).toContain('event: error\ndata: {"code":"CHAT_MODEL_FAILED"}');
    expect(text).not.toContain("detail");
  });
  it("maps failures before the stream opens to coded JSON errors", async () => {
    jsonReply = { status: 404, body: { error: { code: "CHAT_THREAD_NOT_FOUND", message: "m" } } };
    const res = await turns.POST(req("/x", "POST", { json: { message: "hi" } }), P("th-9"));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
    jsonReply = { status: 503, body: { error: { code: "MEMORY_DISABLED" } } };
    expect((await (await turns.POST(req("/x", "POST", { json: { message: "hi" } }), P("th-1"))).json()).code).toBe("MEMORY_DISABLED");
  });
  it("validates the body before any backend call: size, kind, audio ids, unknown keys, thread id, content type", async () => {
    for (const json of [{ message: "" }, { message: "x".repeat(1001) }, { message: "hi", inputKind: "audio" }, { message: "hi", audioDocumentId: "d1" }, { message: "hi", householdId: "h2" }]) {
      expect((await turns.POST(req("/x", "POST", { json }), P("th-1"))).status, JSON.stringify(json).slice(0, 40)).toBe(400);
    }
    expect((await turns.POST(req("/x", "POST", { json: { message: "hi" } }), P("../x"))).status).toBe(400);
    expect((await turns.POST(new Request("http://app.test/x", { method: "POST", headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "text/plain", "content-length": "2" }, body: "hi" }), P("th-1"))).status).toBe(415);
    expect(calls).toHaveLength(0);
  });
  it("maps a procedure block to the backend names", async () => {
    sse = [frame("done", {})];
    await turns.POST(req("/x", "POST", { json: { message: "knee", procedure: { plannedDate: "2027-01-15", estimatedCostInr: 300000, roomRentPerDayInr: 6000, stayDays: 4 } } }), P("th-1"));
    expect((calls[0]?.body as { procedure: unknown }).procedure).toEqual({ planned_date: "2027-01-15", estimated_cost_inr: 300000, room_rent_per_day_inr: 6000, stay_days: 4 });
  });
  it("is a Node runtime route", () => {
    expect(turns.runtime).toBe("nodejs");
  });
});

describe("hospitals", () => {
  it("returns the agreed shape and keeps only contract fields", async () => {
    jsonReply = { status: 200, body: { hospitals: [{ id: "h1", name: "Example City Hospital", address: "1 Road", city: "Mumbai", pincode: "400053", cashless: true, tpa_code: "x" }] } };
    const res = await hospitals.GET(req("/api/app/covers/holdings/hold-1/hospitals?pincode=400053", "GET"), P("hold-1"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.hospitals).toEqual([{ id: "h1", name: "Example City Hospital", address: "1 Road", city: "Mumbai", pincode: "400053", cashless: true }]);
    expect(calls[0]).toMatchObject({ method: "GET", url: "/api/v1/holdings/hold-1/hospitals?pincode=400053" });
  });
  it("refuses a bad pincode and a UIN in the body", async () => {
    expect((await hospitals.GET(req("/x?pincode=12", "GET"), P("hold-1"))).status).toBe(400);
    expect((await hospitals.GET(req("/x", "GET"), P("hold-1"))).status).toBe(400);
    jsonReply = { status: 200, body: { hospitals: [{ id: "h1", name: `Plan ${FAKE_UIN}`, cashless: true }] } };
    expect((await hospitals.GET(req("/x?pincode=400053", "GET"), P("hold-1"))).status).toBe(502);
  });
  it("answers a coded error while the backend route is pending", async () => {
    jsonReply = { status: 404, body: { error: { code: "ROUTE_NOT_FOUND" } } };
    const res = await hospitals.GET(req("/x?pincode=400053", "GET"), P("hold-1"));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });
});
