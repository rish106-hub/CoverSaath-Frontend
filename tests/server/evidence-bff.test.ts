import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openValue, seal, sealValue } from "@/server/backend/session";
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

import * as profile from "@/app/api/app/documents/[id]/policy-profile/route";
import * as confirm from "@/app/api/app/documents/[id]/policy-profile/confirm/route";
import * as questions from "@/app/api/app/cases/[caseId]/questions/route";
import * as answers from "@/app/api/app/cases/[caseId]/answers/[answerId]/route";
import * as catalogue from "@/app/api/app/cases/[caseId]/decision-catalogue/route";
import * as reviews from "@/app/api/app/cases/[caseId]/catalogue-reviews/route";
import * as sourcePack from "@/app/api/app/cases/[caseId]/source-pack/route";
import * as inventory from "@/app/api/app/cases/[caseId]/deletion-inventory/route";
import * as confirmers from "@/app/api/app/catalogue-confirmers/route";
import * as preview from "@/app/api/app/coverage-preview/route";
import * as integrations from "@/app/api/app/integrations/route";
import * as consent from "@/app/api/app/documents/consent/route";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Reply = { status: number; body: unknown };
let calls: Call[];
let routes: Record<string, Reply | (() => Reply)>;

const bk = (code: string) => ({ error: { code, message: "backend words that must not leak" } });
const DOC = { id: "doc-1", documentKind: "policy_wording", byteSize: 64, status: "accepted", uploadedAt: "2026-11-10T00:00:00.000Z" };
const req = (path: string, method = "GET", o: { json?: unknown; headers?: Record<string, string>; marker?: boolean } = {}) =>
  new Request(`http://app.test${path}`, {
    method,
    headers: { host: "app.test", ...(o.marker === false ? {} : { "x-knowvia-app": "1" }), ...(o.json !== undefined ? { "content-type": "application/json" } : {}), ...o.headers },
    body: o.json === undefined ? undefined : JSON.stringify(o.json),
  });
const p = <T extends Record<string, string>>(v: T) => ({ params: Promise.resolve(v) });
const state = () => openValue<DocsState>(jar.get(DOCS_COOKIE), SECRET);
const setState = (s: Partial<DocsState>) => jar.set(DOCS_COOKIE, sealValue({ h: "h1", exp: Date.now() + 60_000, d: {}, ...s }, SECRET));

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  jar.clear();
  jar.set("kv_session", seal({ t: "tok-secret", h: "h1", m: "m1", a: "adult1", exp: Date.now() + 60_000 }, SECRET));
  setState({ c: "case-1", g: "consent-1", v: "view-1" });
  calls = [];
  routes = {
    "GET /api/v1/documents/doc-1/policy-profile": { status: 200, body: { version: 0, totalPages: 3, proposals: { insurerCode: "SYN" } } },
    "POST /api/v1/documents/doc-1/policy-profile/confirm": { status: 200, body: { version: 1 } },
    "GET /api/v1/cases/case-1/documents": { status: 200, body: { caseId: "case-1", documents: [DOC, { ...DOC, id: "doc-2", status: "rejected" }] } },
    "POST /api/v1/consents": { status: 201, body: { id: "q-grant-1" } },
    "POST /api/v1/consents/q-grant-1/revoke": { status: 200, body: {} },
    "POST /api/v1/consents/consent-1/revoke": { status: 200, body: {} },
    "POST /api/v1/consents/view-1/revoke": { status: 200, body: {} },
    "POST /api/v1/cases/case-1/questions": { status: 200, body: { answerId: "a-1", state: "extracted_unverified" } },
    "GET /api/v1/cases/case-1/questions/a-1": { status: 200, body: { answerId: "a-1" } },
    "GET /api/v1/cases/case-1/decision-catalogue": { status: 200, body: { facts: [] } },
    "POST /api/v1/cases/case-1/decision-catalogue/reviews": { status: 200, body: { recorded: true } },
    "GET /api/v1/cases/case-1/source-pack": { status: 200, body: { documents: [] } },
    "GET /api/v1/cases/case-1/documents/deletion-inventory": { status: 200, body: { caseId: "case-1", documents: [DOC] } },
    "POST /api/v1/households/h1/catalogue-reviewers": { status: 201, body: { adultUserId: "adult1" } },
    "POST /api/v1/households/h1/coverage-preview": { status: 200, body: { members: [] } },
    "GET /api/v1/integrations": { status: 200, body: { sarvam: false } },
  };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    calls.push({ url: u.pathname + u.search, method, headers: init.headers as Record<string, string>, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
    const r = routes[`${method} ${u.pathname}`];
    const reply = typeof r === "function" ? r() : r ?? { status: 404, body: bk("CASE_NOT_FOUND") };
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
});
afterEach(() => vi.unstubAllGlobals());

const doc = p({ id: "doc-1" });
const key = { "idempotency-key": "profile-key-12345678" };

describe("policy profile", () => {
  it("proxies GET with the session's bearer token, wraps the body, and forwards no browser headers", async () => {
    const res = await profile.GET(req("/api/app/documents/doc-1/policy-profile", "GET", { headers: { cookie: "kv_session=x", origin: "http://app.test" } }), doc);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { version: 0, totalPages: 3, proposals: { insurerCode: "SYN" } } });
    const c = calls.at(-1)!;
    expect(c.url).toBe("/api/v1/documents/doc-1/policy-profile");
    expect(c.headers.authorization).toBe("Bearer tok-secret");
    expect(c.headers.origin).toBeUndefined();
    expect(c.headers.cookie).toBeUndefined();
  });
  it("needs a session", async () => {
    jar.delete("kv_session");
    const res = await profile.GET(req("/api/app/documents/doc-1/policy-profile"), doc);
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("refuses a bad document id before any backend call", async () => {
    const res = await profile.GET(req("/api/app/documents/x/policy-profile"), p({ id: "../etc" }));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("confirms with the Idempotency-Key and expectedVersion passed through", async () => {
    const statement = { uin: "SYNTH00001V010101", insurerName: "Synthetic Insurer", expectedVersion: 0 };
    const res = await confirm.POST(req("/api/app/documents/doc-1/policy-profile/confirm", "POST", { json: statement, headers: key }), doc);
    expect(res.status).toBe(200);
    expect((await res.json()).data.version).toBe(1);
    const c = calls.at(-1)!;
    expect(c).toMatchObject({ method: "POST", url: "/api/v1/documents/doc-1/policy-profile/confirm", body: statement });
    expect(c.headers["idempotency-key"]).toBe("profile-key-12345678");
  });
  it("refuses a confirm without a usable key, with an unknown field, or without expectedVersion, before the backend", async () => {
    const noKey = await confirm.POST(req("/api/app/documents/doc-1/policy-profile/confirm", "POST", { json: { expectedVersion: 0 } }), doc);
    expect(noKey.status).toBe(400);
    expect((await noKey.json()).code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect((await confirm.POST(req("/x", "POST", { json: { expectedVersion: 0, state: "proven" }, headers: key }), doc)).status).toBe(400);
    expect((await confirm.POST(req("/x", "POST", { json: { uin: "SYNTH00001V010101" }, headers: key }), doc)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("blocks a confirm without the app marker", async () => {
    const res = await confirm.POST(req("/x", "POST", { json: { expectedVersion: 0 }, headers: key, marker: false }), doc);
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("maps backend codes to coded errors, never forwards backend text, and keeps the session", async () => {
    const cases: [number, string, number, string, boolean][] = [
      [404, "POLICY_PROFILE_NOT_FOUND", 404, "POLICY_PROFILE_NOT_FOUND", false],
      [409, "POLICY_PROFILE_VERSION_CONFLICT", 409, "POLICY_PROFILE_VERSION_CONFLICT", false],
      [422, "POLICY_PROFILE_INVALID_UIN", 422, "POLICY_PROFILE_INVALID_UIN", false],
      [409, "POLICY_PROFILE_NOT_READY", 409, "POLICY_PROFILE_NOT_READY", true],
      [409, "STRUCTURING_RESTART_REQUIRED", 409, "STRUCTURING_RESTART", false],
    ];
    for (const [status, code, outStatus, outCode, retryable] of cases) {
      routes["GET /api/v1/documents/doc-1/policy-profile"] = { status, body: bk(code) };
      const res = await profile.GET(req("/x"), doc);
      const body = await res.json();
      expect(res.status).toBe(outStatus);
      expect(body).toEqual({ ok: false, code: outCode, retryable });
      expect(JSON.stringify(body)).not.toContain("backend words");
    }
    expect(jar.get("kv_session")).toBeTruthy();
  });
  it("ends the session only on the backend's coded token rejection", async () => {
    routes["GET /api/v1/documents/doc-1/policy-profile"] = { status: 401, body: { error: "Unauthorized" } };
    const proxy = await profile.GET(req("/x"), doc);
    expect(proxy.status).toBe(502);
    expect(await proxy.json()).toMatchObject({ code: "BACKEND_UNREACHABLE", retryable: true });
    expect(jar.get("kv_session")).toBeTruthy();

    routes["GET /api/v1/documents/doc-1/policy-profile"] = { status: 401, body: bk("AUTHENTICATION_REQUIRED") };
    const ended = await profile.GET(req("/x"), doc);
    expect(ended.status).toBe(401);
    expect((await ended.json()).code).toBe("UNAUTHENTICATED");
    expect(jar.get("kv_session")).toBe("");
  });
});

describe("questions", () => {
  const ask = (json: unknown, headers: Record<string, string> = { "idempotency-key": "ask-key-12345678" }, caseId = "case-1") =>
    questions.POST(req(`/api/app/cases/${caseId}/questions`, "POST", { json, headers }), p({ caseId }));

  it("makes a document-set grant for the model recipient, forwards its id and the key, and tracks the grant", async () => {
    const res = await ask({ question: "What is the waiting period?", documentIds: ["doc-1"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { answerId: "a-1", state: "extracted_unverified" } });
    const grant = calls.find((c) => c.url === "/api/v1/consents")!;
    expect(grant.headers["idempotency-key"]).toMatch(/^ask-case-1-[a-f0-9]{16}-/);
    expect(grant.body).toMatchObject({
      householdId: "h1", subjectAdultId: "adult1", purpose: "document_processing", grantedToActor: "google-gemini",
      scopes: [{ resourceType: "document", resourceId: "doc-1", action: "derive", dataCategory: "insurance_question", recipient: "google-gemini" }],
    });
    const q = calls.find((c) => c.url === "/api/v1/cases/case-1/questions")!;
    expect(q.body).toEqual({ question: "What is the waiting period?", consentGrantId: "q-grant-1", documentIds: ["doc-1"] });
    expect(q.headers["idempotency-key"]).toBe("ask-key-12345678");
    expect(state()?.q).toEqual(["q-grant-1"]);
  });
  it("defaults to the accepted documents of the case", async () => {
    await ask({ question: "Is maternity covered?" });
    expect(calls.find((c) => c.url === "/api/v1/cases/case-1/questions")!.body).toMatchObject({ documentIds: ["doc-1"] });
  });
  it("needs the reading go-ahead, a case of this session, and documents of that case", async () => {
    setState({ c: "case-1" });
    const noConsent = await ask({ question: "Q?" });
    expect(noConsent.status).toBe(403);
    expect((await noConsent.json()).code).toBe("CONSENT_REQUIRED");
    setState({ c: "case-1", g: "consent-1" });
    expect((await ask({ question: "Q?" }, undefined, "case-9")).status).toBe(404);
    expect((await ask({ question: "Q?", documentIds: ["doc-other"] })).status).toBe(404);
    expect((await ask({ question: "Q?", documentIds: ["doc-2"] })).status).toBe(404);
    // The case-read grant may be made to list documents; no grant for the model is made and no question is sent.
    expect(calls.some((c) => c.url === "/api/v1/consents" && JSON.stringify(c.body).includes("insurance_question"))).toBe(false);
    expect(calls.some((c) => c.url.endsWith("/questions"))).toBe(false);
  });
  it("refuses a missing key and an empty question before any backend call", async () => {
    expect((await ask({ question: "Q?" }, {})).status).toBe(400);
    expect((await ask({ question: "  " })).status).toBe(400);
    expect((await ask({ question: "Q?", extra: 1 })).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("revokes the question grant when the reading consent is withdrawn", async () => {
    await ask({ question: "Q?", documentIds: ["doc-1"] });
    calls = [];
    const res = await consent.DELETE(req("/api/app/documents/consent", "DELETE"));
    expect(res.status).toBe(200);
    expect(calls.map((c) => c.url)).toContain("/api/v1/consents/q-grant-1/revoke");
    expect(state()?.q).toBeUndefined();
  });
  it("reads an answer of the session's case only", async () => {
    const ok = await answers.GET(req("/x"), p({ caseId: "case-1", answerId: "a-1" }));
    expect(ok.status).toBe(200);
    expect((await answers.GET(req("/x"), p({ caseId: "case-9", answerId: "a-1" }))).status).toBe(404);
  });
});

describe("catalogue, preview, source pack, inventory, integrations", () => {
  it("passes the handoff query through and wraps the answer", async () => {
    const res = await catalogue.GET(req("/api/app/cases/case-1/decision-catalogue?answerId=a-1&asOf=2026-11-01"), p({ caseId: "case-1" }));
    expect(res.status).toBe(200);
    expect(calls.at(-1)!.url).toBe("/api/v1/cases/case-1/decision-catalogue?format=handoff&answerId=a-1&asOf=2026-11-01");
  });
  it("records a review with the key and refuses one without", async () => {
    const body = { answerId: "a-1", factId: "f-1", decision: "accepted", reasonCode: "matches_clause" };
    const ok = await reviews.POST(req("/x", "POST", { json: body, headers: { "idempotency-key": "review-key-12345" } }), p({ caseId: "case-1" }));
    expect(ok.status).toBe(200);
    expect(calls.at(-1)!.headers["idempotency-key"]).toBe("review-key-12345");
    expect((await reviews.POST(req("/x", "POST", { json: body }), p({ caseId: "case-1" }))).status).toBe(400);
  });
  it("lets a person name only themselves as confirmer", async () => {
    const ok = await confirmers.POST(req("/x", "POST", { json: { adultUserId: "adult1" } }));
    expect(ok.status).toBe(201);
    const other = await confirmers.POST(req("/x", "POST", { json: { adultUserId: "adult2" } }));
    expect(other.status).toBe(403);
    expect(calls.filter((c) => c.url.includes("catalogue-reviewers"))).toHaveLength(1);
  });
  it("validates the preview body and sends the session's household", async () => {
    const good = { contractVersion: "household-scenario/v1", sources: [{ caseId: "case-1", answerId: "a-1" }], scenario: { members: [] } };
    expect((await preview.POST(req("/x", "POST", { json: good }))).status).toBe(200);
    expect(calls.at(-1)!.url).toBe("/api/v1/households/h1/coverage-preview");
    expect((await preview.POST(req("/x", "POST", { json: { ...good, contractVersion: "v0" } }))).status).toBe(400);
    expect((await preview.POST(req("/x", "POST", { json: { ...good, sources: [] } }))).status).toBe(400);
  });
  it("answers the source pack, the deletion inventory without the read grant, and integrations", async () => {
    setState({ c: "case-1" }); // reading go-ahead withdrawn
    const inv = await inventory.GET(req("/x"), p({ caseId: "case-1" }));
    expect(inv.status).toBe(200);
    expect(calls.some((c) => c.url === "/api/v1/consents")).toBe(false);
    setState({ c: "case-1", g: "consent-1", v: "view-1" });
    expect((await sourcePack.GET(req("/x"), p({ caseId: "case-1" }))).status).toBe(200);
    expect((await integrations.GET(req("/x"))).status).toBe(200);
    expect((await sourcePack.GET(req("/x"), p({ caseId: "case-9" }))).status).toBe(404);
  });
});

describe("one BFF, no database in the app", () => {
  it("has no pg dependency and no route imports a database driver", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).filter((n) => n === "pg" || n === "@types/pg" || n === "postgres")).toEqual([]);
    for (const f of ["src/server/backend/evidence.ts", "src/adapters/evidence.ts"]) expect(readFileSync(f, "utf8")).not.toMatch(/from "pg"|postgres/);
  });
  it("keeps the backend URL out of the browser adapter", () => {
    expect(readFileSync("src/adapters/evidence.ts", "utf8")).not.toContain("/api/v1");
  });
});
