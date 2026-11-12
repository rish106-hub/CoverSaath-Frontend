import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal, sealValue } from "@/server/backend/session";
import { DOCS_COOKIE, type DocsState } from "@/server/backend/documents";

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

import * as holdingsRoute from "@/app/api/app/covers/holdings/route";
import * as candidates from "@/app/api/app/covers/holdings/[id]/candidates/route";
import * as confirm from "@/app/api/app/covers/holdings/[id]/confirm/route";
import * as facts from "@/app/api/app/covers/holdings/[id]/facts/route";
import * as holdingDocs from "@/app/api/app/covers/holdings/[id]/documents/route";
import * as conflicts from "@/app/api/app/covers/holdings/[id]/conflicts/route";
import * as resolve from "@/app/api/app/covers/holdings/[id]/conflicts/[cid]/resolve/route";
import * as declarations from "@/app/api/app/covers/declarations/route";
import * as premiums from "@/app/api/app/covers/premiums/route";
import * as declarationRow from "@/app/api/app/covers/declarations/[did]/route";
import * as premiumRow from "@/app/api/app/covers/premiums/[pid]/route";
import * as dues from "@/app/api/app/covers/premium-dues/route";
import * as duePay from "@/app/api/app/covers/premium-dues/[did]/pay/route";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Reply = { status: number; body: unknown };
let calls: Call[];
let routes: Record<string, Reply>;

const bk = (code: string) => ({ error: { code, message: "backend words that must not leak" } });
const req = (path: string, method = "GET", o: { json?: unknown; headers?: Record<string, string>; marker?: boolean } = {}) =>
  new Request(`http://app.test${path}`, {
    method,
    headers: { host: "app.test", ...(o.marker === false ? {} : { "x-knowvia-app": "1" }), ...(o.json !== undefined ? { "content-type": "application/json" } : {}), ...o.headers },
    body: o.json === undefined ? undefined : JSON.stringify(o.json),
  });
const p = <T extends Record<string, string>>(v: T) => ({ params: Promise.resolve(v) });
const H = p({ id: "holding-1" });
const key = { "idempotency-key": "confirm-key-12345678" };
// A synthetic registry number in the shape of a UIN. It must never reach a response.
const FAKE_UIN = "SYNTH00001V010101";

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  jar.clear();
  jar.set("kv_session", seal({ t: "tok-secret", h: "h1", m: "m1", a: "adult1", exp: Date.now() + 60_000 }, SECRET));
  jar.set(DOCS_COOKIE, sealValue({ h: "h1", exp: Date.now() + 60_000, d: {}, c: "case-1", g: "consent-1", v: "view-1" } satisfies DocsState, SECRET));
  calls = [];
  routes = {
    "GET /api/v1/households/h1/holdings": { status: 200, body: { holdings: [{ id: "holding-1", householdId: "h1", documentId: "doc-1", kind: "policy_wording", status: "uploaded", policyProfileId: "pp-1" }] } },
    "GET /api/v1/holdings/holding-1/product-candidates": { status: 200, body: { holdingId: "holding-1", profileVersion: 0, candidates: [{ candidateId: "product-1", insurerName: "Example Insurer", productName: "Example Health Plan 01", rank: 1, uin: FAKE_UIN }] } },
    "POST /api/v1/holdings/holding-1/confirm-product": { status: 200, body: { holdingId: "holding-1", status: "product_reported", profileVersion: 1, replay: false } },
    "GET /api/v1/holdings/holding-1/facts": { status: 200, body: { holdingId: "holding-1", status: "conflicts", facts: [{ factKey: "sum_insured", factClass: "personal_value", valueType: "money", unit: "paise", group: "limits", status: "extracted_unverified", value: 50000000, sourceIds: ["x"], alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s1", tier: "own_pdf", status: "extracted_unverified", value: 50000000, page: { pageId: "page-1", blockIndex: 0 }, quote: "Sum insured Rs 5,00,000", current: true }] }], unknownKeys: ["copay_percent"] } },
    "GET /api/v1/holdings/holding-1/documents": { status: 200, body: { holdingId: "holding-1", documents: [{ documentId: "doc-1", kind: "schedule", extra: "dropped" }] } },
    "POST /api/v1/holdings/holding-1/documents": { status: 200, body: { holdingId: "holding-1", documentId: "doc-2", kind: "wording", linked: true } },
    "GET /api/v1/holdings/holding-1/conflicts": { status: 200, body: { holdingId: "holding-1", status: "conflicts", conflicts: [{ id: "c-1", factKey: "room_rent_limit", factClass: "product_term", valueType: "text", reason: "own_vs_insurer", resolution: "pending", resolvedAt: null, resolvingFactId: null, checkWithInsurer: true, candidates: [{ id: "f1", tier: "own_pdf", value: "1%", quote: "1% per day" }, { id: "f2", tier: "ida_wording", value: "2%", quote: "2% per day" }] }] } },
    "POST /api/v1/holdings/holding-1/conflicts/c-1/resolve": { status: 200, body: { conflictId: "c-1", resolvingFactId: "d-1", status: "user_confirmed", holdingStatus: "ready", replay: false } },
  };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    calls.push({ url: u.pathname + u.search, method, headers: init.headers as Record<string, string>, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
    const r = routes[`${method} ${u.pathname}`] ?? { status: 404, body: bk("HOLDING_NOT_FOUND") };
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("holdings and candidates", () => {
  it("lists holdings for the session's household with the bearer token and keeps only contract fields", async () => {
    const res = await holdingsRoute.GET(req("/api/app/covers/holdings"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.holdings).toEqual([{ id: "holding-1", documentId: "doc-1", kind: "policy_wording", status: "uploaded" }]);
    expect(calls[0]).toMatchObject({ url: "/api/v1/households/h1/holdings" });
    expect(calls[0]?.headers.authorization).toBe("Bearer tok-secret");
  });
  it("passes creation_issues through (retrying and failed), in either key style", async () => {
    routes["GET /api/v1/households/h1/holdings"] = { status: 200, body: { holdings: [], creation_issues: [{ document_id: "doc-2", state: "retrying", code: null, extra: "dropped" }, { document_id: "doc-3", state: "failed", code: "HOLDING_CREATE_FAILED" }] } };
    const body = await (await holdingsRoute.GET(req("/api/app/covers/holdings"))).json();
    expect(body.data.creationIssues).toEqual([{ documentId: "doc-2", state: "retrying", code: null }, { documentId: "doc-3", state: "failed", code: "HOLDING_CREATE_FAILED" }]);
    routes["GET /api/v1/households/h1/holdings"] = { status: 200, body: { holdings: [], creationIssues: [{ documentId: "doc-4", state: "failed", code: "HOLDING_CREATE_FAILED" }] } };
    expect((await (await holdingsRoute.GET(req("/api/app/covers/holdings"))).json()).data.creationIssues).toHaveLength(1);
  });
  it("tolerates a backend that does not send creation_issues", async () => {
    const res = await holdingsRoute.GET(req("/api/app/covers/holdings"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.creationIssues).toBeUndefined();
  });
  it("needs a session", async () => {
    jar.delete("kv_session");
    expect((await holdingsRoute.GET(req("/api/app/covers/holdings"))).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("returns candidates as insurer and product name only: a UIN the backend adds is dropped", async () => {
    const res = await candidates.GET(req("/api/app/covers/holdings/holding-1/candidates"), H);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain(FAKE_UIN);
    expect(text).not.toContain("uin");
    expect(JSON.parse(text).data.candidates[0]).toEqual({ candidateId: "product-1", insurerName: "Example Insurer", productName: "Example Health Plan 01", rank: 1 });
  });
  it("refuses a body that carries a UIN in a field the contract does name", async () => {
    routes["GET /api/v1/holdings/holding-1/product-candidates"] = { status: 200, body: { holdingId: "holding-1", profileVersion: 0, candidates: [{ candidateId: "p", insurerName: "Example Insurer", productName: `Plan ${FAKE_UIN}`, rank: 1 }] } };
    const res = await candidates.GET(req("/x"), H);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain(FAKE_UIN);
  });
  it("refuses a bad holding id before any backend call", async () => {
    expect((await candidates.GET(req("/x"), p({ id: "../etc" }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe("holding documents", () => {
  it("lists the linked documents with the bearer token and keeps only contract fields", async () => {
    const res = await holdingDocs.GET(req("/x"), H);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ holdingId: "holding-1", documents: [{ documentId: "doc-1", kind: "schedule" }] });
    expect(calls[0]).toMatchObject({ method: "GET", url: "/api/v1/holdings/holding-1/documents" });
    expect(calls[0]?.headers.authorization).toBe("Bearer tok-secret");
  });
  it("links a document: sends only documentId and kind, kind defaults to wording", async () => {
    const res = await holdingDocs.POST(req("/x", "POST", { json: { documentId: "doc-2" } }), H);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ holdingId: "holding-1", documentId: "doc-2", kind: "wording", linked: true });
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: "/api/v1/holdings/holding-1/documents", body: { documentId: "doc-2", kind: "wording" } });
  });
  it("refuses a bad body, an unknown field, an unknown kind and a bad holding id before the backend", async () => {
    for (const json of [null, {}, { documentId: "../x" }, { documentId: "doc-2", kind: "schedule" }, { documentId: "doc-2", uin: FAKE_UIN }]) {
      const res = await holdingDocs.POST(req("/x", "POST", json === null ? {} : { json }), H);
      expect(res.status, JSON.stringify(json)).toBe(400);
    }
    expect((await holdingDocs.POST(req("/x", "POST", { json: { documentId: "doc-2" } }), p({ id: "../etc" }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("needs a session and the app marker", async () => {
    expect((await holdingDocs.POST(req("/x", "POST", { json: { documentId: "doc-2" }, marker: false }), H)).status).toBe(403);
    jar.delete("kv_session");
    expect((await holdingDocs.GET(req("/x"), H)).status).toBe(401);
    expect((await holdingDocs.POST(req("/x", "POST", { json: { documentId: "doc-2" } }), H)).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("maps backend codes to coded errors without backend text", async () => {
    const cases: [number, string, number, string][] = [
      [503, "HOLDINGS_DISABLED", 503, "HOLDINGS_DISABLED"],
      [404, "HOLDING_NOT_FOUND", 404, "NOT_FOUND"],
      [404, "DOCUMENT_NOT_FOUND", 404, "NOT_FOUND"],
    ];
    for (const [status, code, outStatus, outCode] of cases) {
      routes["POST /api/v1/holdings/holding-1/documents"] = { status, body: bk(code) };
      const res = await holdingDocs.POST(req("/x", "POST", { json: { documentId: "doc-2" } }), H);
      const text = await res.text();
      expect(res.status, code).toBe(outStatus);
      expect(JSON.parse(text).code, code).toBe(outCode);
      expect(text).not.toContain("must not leak");
    }
  });
  it("refuses a backend body outside the contract", async () => {
    routes["POST /api/v1/holdings/holding-1/documents"] = { status: 200, body: { holdingId: "holding-1", linked: "yes" } };
    expect((await holdingDocs.POST(req("/x", "POST", { json: { documentId: "doc-2" } }), H)).status).toBe(502);
  });
});

describe("confirm product", () => {
  it("sends candidateId and expectedVersion with the Idempotency-Key", async () => {
    const res = await confirm.POST(req("/x", "POST", { json: { candidateId: "product-1", expectedVersion: 0 }, headers: key }), H);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ holdingId: "holding-1", status: "product_reported", profileVersion: 1, replay: false });
    const c = calls.at(-1)!;
    expect(c).toMatchObject({ method: "POST", url: "/api/v1/holdings/holding-1/confirm-product", body: { candidateId: "product-1", expectedVersion: 0 } });
    expect(c.headers["idempotency-key"]).toBe("confirm-key-12345678");
  });
  it("refuses a missing key, a UIN from the browser, an unknown field or a missing version before the backend", async () => {
    expect((await confirm.POST(req("/x", "POST", { json: { candidateId: "p", expectedVersion: 0 } }), H)).status).toBe(400);
    expect((await confirm.POST(req("/x", "POST", { json: { candidateId: "p", expectedVersion: 0, uin: FAKE_UIN }, headers: key }), H)).status).toBe(400);
    expect((await confirm.POST(req("/x", "POST", { json: { candidateId: "p" }, headers: key }), H)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("blocks a write without the app marker", async () => {
    expect((await confirm.POST(req("/x", "POST", { json: { candidateId: "p", expectedVersion: 0 }, headers: key, marker: false }), H)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("maps backend codes to coded errors without backend text", async () => {
    const cases: [number, string, number, string][] = [
      [503, "HOLDINGS_DISABLED", 503, "HOLDINGS_DISABLED"],
      [404, "HOLDING_NOT_FOUND", 404, "NOT_FOUND"],
      [422, "HOLDING_PRODUCT_UNSUPPORTED", 422, "HOLDING_PRODUCT_UNSUPPORTED"],
      [409, "POLICY_PROFILE_VERSION_CONFLICT", 409, "POLICY_PROFILE_VERSION_CONFLICT"],
    ];
    for (const [status, code, outStatus, outCode] of cases) {
      routes["POST /api/v1/holdings/holding-1/confirm-product"] = { status, body: bk(code) };
      const res = await confirm.POST(req("/x", "POST", { json: { candidateId: "p", expectedVersion: 0 }, headers: key }), H);
      const text = await res.text();
      expect(res.status, code).toBe(outStatus);
      expect(JSON.parse(text).code, code).toBe(outCode);
      expect(text).not.toContain("must not leak");
    }
  });
});

describe("facts, conflicts, resolve", () => {
  it("passes facts through the contract: sources with page and quote, drops fields it does not name", async () => {
    const res = await facts.GET(req("/x"), H);
    const d = (await res.json()).data;
    expect(res.status).toBe(200);
    expect(d.facts[0].sources[0]).toMatchObject({ tier: "own_pdf", quote: "Sum insured Rs 5,00,000" });
    expect(d.facts[0].sourceIds).toBeUndefined();
    expect(d.unknownKeys).toEqual(["copay_percent"]);
    expect(calls.at(-1)?.url).toBe("/api/v1/holdings/holding-1/facts");
  });
  it("returns a conflict with both readings", async () => {
    const d = (await (await conflicts.GET(req("/x"), H)).json()).data;
    expect(d.conflicts[0].candidates.map((c: { id: string }) => c.id)).toEqual(["f1", "f2"]);
    expect(d.conflicts[0].checkWithInsurer).toBe(true);
  });
  it("resolves with the chosen fact id only", async () => {
    const res = await resolve.POST(req("/x", "POST", { json: { chosenFactId: "f2" } }), p({ id: "holding-1", cid: "c-1" }));
    expect(res.status).toBe(200);
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: "/api/v1/holdings/holding-1/conflicts/c-1/resolve", body: { chosenFactId: "f2" } });
  });
  it("refuses a bad choice before the backend and maps an already-settled conflict", async () => {
    expect((await resolve.POST(req("/x", "POST", { json: { chosenFactId: "f2", state: "proven" } }), p({ id: "holding-1", cid: "c-1" }))).status).toBe(400);
    expect((await resolve.POST(req("/x", "POST", { json: {} }), p({ id: "holding-1", cid: "c-1" }))).status).toBe(400);
    expect(calls).toHaveLength(0);
    routes["POST /api/v1/holdings/holding-1/conflicts/c-1/resolve"] = { status: 409, body: bk("MEMORY_CONFLICT_ALREADY_RESOLVED") };
    const res = await resolve.POST(req("/x", "POST", { json: { chosenFactId: "f2" } }), p({ id: "holding-1", cid: "c-1" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CONFLICT_ALREADY_RESOLVED");
  });
});

const BASE = "/api/v1/households/h1";
const decl = { memberId: "m1", kind: "pre_existing_disease", label: "Example condition" };
const declRow = { id: "decl-1", memberId: "m1", holdingId: null, kind: "pre_existing_disease", label: "Example condition", declaredOn: null, declaredToInsurer: null, revision: 1, documentId: "x", createdAt: "t" };
const payRow = { id: "ppay-1", holdingId: "holding-1", amountPaise: 1850000, paidOn: "2026-10-01", channel: "upi", paidVia: "self", agentName: null, agentCode: null, amountBand: "b", createdAt: "t" };
const dueRow = { id: "pdue-1", holdingId: "holding-1", dueOn: "2026-12-01", amountPaise: 1850000, state: "expected", paidPaymentId: null, amountBand: "b" };

describe("declarations (household-scoped backend routes)", () => {
  it("lists, creates, updates and deletes on the exact backend paths with no consent grant sent", async () => {
    routes[`GET ${BASE}/declarations`] = { status: 200, body: { declarations: [declRow], truncated: false } };
    routes[`POST ${BASE}/declarations`] = { status: 201, body: declRow };
    routes[`PUT ${BASE}/declarations/decl-1`] = { status: 200, body: { ...declRow, revision: 2 } };
    routes[`DELETE ${BASE}/declarations/decl-1`] = { status: 200, body: { deleted: true } };
    const list = await declarations.GET(req("/api/app/covers/declarations?memberId=m1"));
    expect((await list.json()).data.declarations[0]).toEqual({ id: "decl-1", memberId: "m1", holdingId: null, kind: "pre_existing_disease", label: "Example condition", declaredOn: null, declaredToInsurer: null, revision: 1 });
    expect(calls.at(-1)).toMatchObject({ method: "GET", url: `${BASE}/declarations?memberId=m1` });
    const made = await declarations.POST(req("/x", "POST", { json: decl }));
    expect(made.status).toBe(201);
    const sent = calls.at(-1);
    expect(sent).toMatchObject({ method: "POST", url: `${BASE}/declarations` });
    expect(JSON.stringify(sent?.body)).not.toContain("consentGrantId");
    const upd = await declarationRow.PUT(req("/x", "PUT", { json: { label: "Changed", ifMatch: 1 } }), p({ did: "decl-1" }));
    expect(upd.status).toBe(200);
    expect(calls.at(-1)).toMatchObject({ method: "PUT", url: `${BASE}/declarations/decl-1`, body: { label: "Changed", declaredOn: null, declaredToInsurer: null, ifMatch: 1 } });
    const del = await declarationRow.DELETE(req("/x", "DELETE"), p({ did: "decl-1" }));
    expect((await del.json()).data).toEqual({ deleted: true });
    expect(calls.at(-1)).toMatchObject({ method: "DELETE", url: `${BASE}/declarations/decl-1` });
  });
  it("refuses bad input before the backend", async () => {
    expect((await declarations.POST(req("/x", "POST", { json: { ...decl, kind: "nope" } }))).status).toBe(400);
    expect((await declarations.POST(req("/x", "POST", { json: { ...decl, consentGrantId: "g" } }))).status).toBe(400);
    expect((await declarationRow.PUT(req("/x", "PUT", { json: { label: "" } }), p({ did: "decl-1" }))).status).toBe(400);
    expect((await declarationRow.DELETE(req("/x", "DELETE"), p({ did: "../x" }))).status).toBe(400);
    expect((await declarations.GET(req("/x?memberId=a/b"))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("maps a stale revision and a missing row to coded errors", async () => {
    routes[`PUT ${BASE}/declarations/decl-1`] = { status: 409, body: bk("REVISION_CONFLICT") };
    const res = await declarationRow.PUT(req("/x", "PUT", { json: { label: "Changed", ifMatch: 0 } }), p({ did: "decl-1" }));
    expect([res.status, (await res.json()).code]).toEqual([409, "REVISION_CONFLICT"]);
    routes[`DELETE ${BASE}/declarations/decl-9`] = { status: 404, body: bk("DECLARATION_NOT_FOUND") };
    const gone = await declarationRow.DELETE(req("/x", "DELETE"), p({ did: "decl-9" }));
    expect([gone.status, (await gone.json()).code]).toEqual([404, "NOT_FOUND"]);
  });
});

describe("premiums and dues (household-scoped backend routes)", () => {
  it("lists, records and deletes premiums", async () => {
    routes[`GET ${BASE}/premiums`] = { status: 200, body: { premiums: [payRow] } };
    routes[`POST ${BASE}/premiums`] = { status: 201, body: payRow };
    routes[`DELETE ${BASE}/premiums/ppay-1`] = { status: 200, body: { deleted: true } };
    const list = await premiums.GET(req("/x?holdingId=holding-1"));
    expect((await list.json()).data.premiums[0].amountBand).toBeUndefined();
    expect(calls.at(-1)).toMatchObject({ method: "GET", url: `${BASE}/premiums?holdingId=holding-1` });
    const pay = { holdingId: "holding-1", amountPaise: 1850000, paidOn: "2026-10-01", channel: "upi", paidVia: "agent", agentName: "Example Agent", agentCode: "A-1" };
    expect((await premiums.POST(req("/x", "POST", { json: pay }))).status).toBe(201);
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: `${BASE}/premiums`, body: { holdingId: "holding-1", paidVia: "agent", payerMemberId: null } });
    expect((await premiums.POST(req("/x", "POST", { json: { ...pay, paidVia: "self" } }))).status).toBe(400); // agent only when paidVia is agent
    expect((await premiums.POST(req("/x", "POST", { json: { ...pay, amountPaise: 0 } }))).status).toBe(400);
    expect((await premiumRow.DELETE(req("/x", "DELETE"), p({ pid: "ppay-1" }))).status).toBe(200);
    expect(calls.at(-1)).toMatchObject({ method: "DELETE", url: `${BASE}/premiums/ppay-1` });
  });
  it("lists and creates dues, then marks one paid", async () => {
    routes[`GET ${BASE}/premium-dues`] = { status: 200, body: { dues: [dueRow] } };
    routes[`POST ${BASE}/premium-dues`] = { status: 201, body: dueRow };
    routes[`POST ${BASE}/premium-dues/pdue-1/pay`] = { status: 200, body: { ...dueRow, state: "paid", paidPaymentId: "ppay-1" } };
    const list = await dues.GET(req("/x?holdingId=holding-1&state=expected"));
    expect((await list.json()).data.dues[0]).toEqual({ id: "pdue-1", holdingId: "holding-1", dueOn: "2026-12-01", amountPaise: 1850000, state: "expected", paidPaymentId: null });
    expect(calls.at(-1)).toMatchObject({ method: "GET", url: `${BASE}/premium-dues?holdingId=holding-1&state=expected` });
    expect((await dues.POST(req("/x", "POST", { json: { holdingId: "holding-1", dueOn: "2026-12-01", amountPaise: 1850000 } }))).status).toBe(201);
    const paid = await duePay.POST(req("/x", "POST", { json: { paymentId: "ppay-1" } }), p({ did: "pdue-1" }));
    expect((await paid.json()).data.state).toBe("paid");
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: `${BASE}/premium-dues/pdue-1/pay`, body: { paymentId: "ppay-1" } });
  });
  it("refuses bad dues input before the backend", async () => {
    expect((await dues.GET(req("/x?state=late"))).status).toBe(400);
    expect((await dues.POST(req("/x", "POST", { json: { holdingId: "holding-1", dueOn: "soon", amountPaise: 1 } }))).status).toBe(400);
    expect((await duePay.POST(req("/x", "POST", { json: {} }), p({ did: "pdue-1" }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe("holdings flag off and consent required", () => {
  const writes: [string, () => Promise<Response>][] = [
    [`POST ${BASE}/declarations`, () => declarations.POST(req("/x", "POST", { json: decl }))],
    [`POST ${BASE}/premiums`, () => premiums.POST(req("/x", "POST", { json: { holdingId: "holding-1", amountPaise: 5, paidOn: "2026-10-01" } }))],
    [`POST ${BASE}/premium-dues`, () => dues.POST(req("/x", "POST", { json: { holdingId: "holding-1", dueOn: "2026-12-01", amountPaise: 5 } }))],
  ];
  it("maps 503 HOLDINGS_DISABLED on every new read and write", async () => {
    const off = { status: 503, body: bk("HOLDINGS_DISABLED") };
    for (const k of ["GET /declarations", "POST /declarations", "PUT /declarations/decl-1", "DELETE /declarations/decl-1", "GET /premiums", "POST /premiums", "DELETE /premiums/ppay-1", "GET /premium-dues", "POST /premium-dues", "POST /premium-dues/pdue-1/pay"]) {
      const [m, path] = k.split(" ");
      routes[`${m} ${BASE}${path}`] = off;
    }
    routes["GET /api/v1/holdings/holding-1/hospitals"] = off;
    const all: Promise<Response>[] = [
      declarations.GET(req("/x")), ...writes.map(([, f]) => f()),
      declarationRow.PUT(req("/x", "PUT", { json: { label: "L" } }), p({ did: "decl-1" })), declarationRow.DELETE(req("/x", "DELETE"), p({ did: "decl-1" })),
      premiums.GET(req("/x")), premiumRow.DELETE(req("/x", "DELETE"), p({ pid: "ppay-1" })), dues.GET(req("/x")),
      duePay.POST(req("/x", "POST", { json: { paymentId: "ppay-1" } }), p({ did: "pdue-1" })),
    ];
    for (const res of await Promise.all(all)) {
      const text = await res.text();
      expect(res.status).toBe(503);
      expect(JSON.parse(text)).toMatchObject({ ok: false, code: "HOLDINGS_DISABLED" });
      expect(text).not.toContain("must not leak");
    }
  });
  it("maps 403 CONSENT_REQUIRED on writes and keeps the session", async () => {
    for (const [k, run] of writes) {
      routes[k.replace("POST ", "POST ").replace(" /", " /")] = { status: 403, body: bk("CONSENT_REQUIRED") };
      const res = await run();
      expect([res.status, (await res.json()).code]).toEqual([403, "CONSENT_REQUIRED"]);
    }
    expect(jar.has("kv_session")).toBe(true);
  });
});

describe("no client component calls the backend", () => {
  it("cover views and adapters only call same-origin /api/app paths", () => {
    for (const f of ["src/adapters/covers.ts", "src/components/covers/AddCoverView.tsx", "src/components/covers/DeclarationsView.tsx", "src/components/covers/CoverReviewView.tsx", "src/components/covers/use-holdings.ts"]) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/\/api\/v1\//);
      expect(text, f).not.toMatch(/KNOWVIA_API_URL|server-only|\bUIN\b.*\brender/);
    }
  });
  it("no cover route runs on the edge", () => {
    for (const f of ["src/app/api/app/covers/holdings/route.ts", "src/app/api/app/covers/declarations/route.ts", "src/app/api/app/covers/premiums/route.ts", "src/app/api/app/covers/declarations/[did]/route.ts", "src/app/api/app/covers/premiums/[pid]/route.ts", "src/app/api/app/covers/premium-dues/route.ts", "src/app/api/app/covers/premium-dues/[did]/pay/route.ts", "src/server/backend/covers.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/runtime\s*=\s*["']edge["']/);
    }
  });
});
