import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal, sealValue } from "@/server/backend/session";
import { DOCS_COOKIE } from "@/server/backend/documents";

// BFF side of the insurer tier (backend ADR 0036, ADR 0039, plan C4/C5): passages with a separate insurer list, the memory document, and
// unknown fields failing safe. Synthetic data only.

const SECRET = "s".repeat(40);
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => ({ host: "localhost:3200" })[n.toLowerCase()] ?? null }),
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
}));

import * as passages from "@/app/api/app/cases/[caseId]/passages/route";
import * as memory from "@/app/api/app/covers/holdings/[id]/memory-document/route";

type Call = { url: string; method: string; headers: Record<string, string> };
let calls: Call[];
let reply: { status: number; body: string; type: string };

const req = (path: string) => new Request(`http://app.test${path}`, { method: "GET", headers: { host: "app.test", "x-knowvia-app": "1" } });
const C = { params: Promise.resolve({ caseId: "case-1" }) };
const CUR = { params: Promise.resolve({ caseId: "current" }) };
const H = { params: Promise.resolve({ id: "holding-1" }) };
const INSURER = { chunkId: "chunk-1", versionId: "ver-1", documentId: "ins-doc-1", page: 9, pageSha256: "a".repeat(64), source: "insurer_wording", label: "From the insurer's wording, not checked", snippet: "Expenses for 60 days before admission are covered.", future: "x" };

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  jar.clear();
  jar.set("kv_session", seal({ t: "tok-secret", h: "h1", m: "m1", a: "adult1", exp: Date.now() + 60_000 }, SECRET));
  jar.set(DOCS_COOKIE, sealValue({ h: "h1", exp: Date.now() + 60_000, d: {}, c: "case-1", g: "consent-1", v: "view-1" }, SECRET));
  calls = [];
  reply = { status: 200, body: "{}", type: "application/json" };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const u = new URL(url);
    calls.push({ url: u.pathname + u.search, method: init.method ?? "GET", headers: init.headers as Record<string, string> });
    return new Response(reply.body, { status: reply.status, headers: { "content-type": reply.type } });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("passages", () => {
  it("returns own and insurer passages as two lists, drops unknown fields and rows that are not insurer wording", async () => {
    reply.body = JSON.stringify({ label: "passage_not_answer", passages: [{ clauseId: "c1", page: 2, snippet: "Own text.", extra: 1 }], insurerPassages: [INSURER, { ...INSURER, chunkId: "x", source: "own_document" }], excluded: [] });
    const res = await passages.GET(req("/api/app/cases/case-1/passages?q=waiting%20period"), C);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.passages).toEqual([{ clauseId: "c1", page: 2, snippet: "Own text." }]);
    expect(data.insurerPassages).toHaveLength(1);
    expect(data.insurerPassages[0]).toMatchObject({ chunkId: "chunk-1", page: 9, source: "insurer_wording" });
    expect(data.insurerPassages[0].future).toBeUndefined();
    expect(calls.at(-1)?.url).toBe("/api/v1/cases/case-1/passages?q=waiting+period");
    expect(calls.at(-1)?.headers.authorization).toBe("Bearer tok-secret");
  });
  it("reads a backend that sends no insurer list as empty", async () => {
    reply.body = JSON.stringify({ passages: [], excluded: [] });
    const { data } = await (await passages.GET(req("/api/app/cases/case-1/passages?q=room"), C)).json();
    expect(data.insurerPassages).toEqual([]);
  });
  it("accepts `current` for the case this session made, and refuses another case", async () => {
    reply.body = JSON.stringify({ passages: [], insurerPassages: [] });
    expect((await passages.GET(req("/api/app/cases/current/passages?q=room"), CUR)).status).toBe(200);
    expect(calls.at(-1)?.url).toContain("/api/v1/cases/case-1/passages");
    const other = await passages.GET(req("/api/app/cases/case-9/passages?q=room"), { params: Promise.resolve({ caseId: "case-9" }) });
    expect(other.status).toBe(404);
  });
  it("passes the backend's 503 READBACK_DISABLED as a coded error without its words", async () => {
    reply = { status: 503, body: JSON.stringify({ error: { code: "READBACK_DISABLED", message: "backend words that must not leak" } }), type: "application/json" };
    const res = await passages.GET(req("/api/app/cases/case-1/passages?q=room"), C);
    expect(res.status).toBe(503);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("READBACK_DISABLED");
    expect(text).not.toContain("must not leak");
  });
  it("`current` with no session case is a 404, and a signed-out call is a 401", async () => {
    jar.set(DOCS_COOKIE, sealValue({ h: "h1", exp: Date.now() + 60_000, d: {} }, SECRET));
    expect((await passages.GET(req("/api/app/cases/current/passages?q=room"), CUR)).status).toBe(404);
    jar.delete("kv_session");
    expect((await passages.GET(req("/api/app/cases/case-1/passages?q=room"), C)).status).toBe(401);
  });
  it("refuses a body that holds a UIN, and keeps the backend notice", async () => {
    reply.body = JSON.stringify({ passages: [{ snippet: "Policy SYNTH00001V010101 text." }], insurerPassages: [] });
    expect((await passages.GET(req("/api/app/cases/case-1/passages?q=room"), C)).status).toBe(502);
    reply.body = JSON.stringify({ notice: "Passages are not answers.", passages: [], insurerPassages: [] });
    expect((await (await passages.GET(req("/api/app/cases/case-1/passages?q=room"), C)).json()).data.notice).toBe("Passages are not answers.");
  });
  it("refuses a bad query before calling the backend", async () => {
    const before = calls.length;
    expect((await passages.GET(req("/api/app/cases/case-1/passages?q=%3Cscript%3E"), C)).status).toBe(400);
    expect((await passages.GET(req("/api/app/cases/case-1/passages"), C)).status).toBe(400);
    expect(calls.length).toBe(before);
  });
  it("fails closed on a body that is not an object", async () => {
    reply.body = JSON.stringify({ passages: "nope" });
    expect((await passages.GET(req("/api/app/cases/case-1/passages?q=room"), C)).status).toBe(502);
  });
});

describe("holding passages", () => {
  const HP = { params: Promise.resolve({ id: "holding-1" }) };
  it("searches only when the holding's document is in the session case", async () => {
    const hp = await import("@/app/api/app/covers/holdings/[id]/passages/route");
    const routes: Record<string, unknown> = {
      "/api/v1/holdings/holding-1/documents": { holdingId: "holding-1", documents: [{ documentId: "doc-1", kind: "schedule" }] },
      "/api/v1/cases/case-1/documents": { caseId: "case-1", documents: [{ id: "doc-1", documentKind: "policy_schedule", byteSize: 1, status: "accepted", uploadedAt: "2026-11-10T00:00:00.000Z" }] },
      "/api/v1/cases/case-1/passages": { passages: [], insurerPassages: [] },
    };
    vi.stubGlobal("fetch", async (url: string) => new Response(JSON.stringify(routes[new URL(url).pathname] ?? {}), { status: 200 }));
    expect((await hp.GET(req("/api/app/covers/holdings/holding-1/passages?q=room"), HP)).status).toBe(200);
    routes["/api/v1/holdings/holding-1/documents"] = { holdingId: "holding-1", documents: [{ documentId: "doc-other", kind: "schedule" }] };
    expect((await hp.GET(req("/api/app/covers/holdings/holding-1/passages?q=room"), HP)).status).toBe(404);
  });
});

describe("memory document", () => {
  const MD = ["# Memory", "", "## Policy", "", "- Product: Example Plan [owner statement]", "- UIN: SYNTH00001V010101 [owner statement]", "", "## Insurer terms your document doesn't state", "", '- Pre-hospital days? 60 days (insurer wording, not checked) Quote: "Up to 60 days." [insurer_wording, p.9]', ""].join("\n");
  it("passes the markdown through as text and drops the UIN line", async () => {
    reply = { status: 200, body: MD, type: "text/markdown; charset=utf-8" };
    const res = await memory.GET(req("/api/app/covers/holdings/holding-1/memory-document"), H);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.holdingId).toBe("holding-1");
    expect(data.markdown).toContain("## Insurer terms your document doesn't state");
    expect(data.markdown).toContain("[insurer_wording, p.9]");
    expect(data.markdown).not.toMatch(/UIN|SYNTH00001V010101/);
    expect(calls.at(-1)?.url).toBe("/api/v1/holdings/holding-1/memory-document");
  });
  it("refuses a success that is not markdown", async () => {
    reply = { status: 200, body: "# Memory\n", type: "text/html" };
    expect((await memory.GET(req("/api/app/covers/holdings/holding-1/memory-document"), H)).status).toBe(502);
  });
  it("refuses a UIN anywhere else in the body", async () => {
    reply = { status: 200, body: "# Memory\n\n- Note SYNTH00001V010101\n", type: "text/markdown" };
    expect((await memory.GET(req("/api/app/covers/holdings/holding-1/memory-document"), H)).status).toBe(502);
  });
  it("turns the backend's coded failures into coded errors without its words", async () => {
    reply = { status: 503, body: JSON.stringify({ error: { code: "MEMORY_DISABLED", message: "backend words that must not leak" } }), type: "application/json" };
    const res = await memory.GET(req("/api/app/covers/holdings/holding-1/memory-document"), H);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(await res.json())).not.toContain("must not leak");
  });
  it("needs a session", async () => {
    jar.delete("kv_session");
    const res = await memory.GET(req("/api/app/covers/holdings/holding-1/memory-document"), H);
    expect(res.status).toBe(401);
  });
});
