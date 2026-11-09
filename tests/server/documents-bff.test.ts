import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/server/backend/session";

const SECRET = "s".repeat(40);
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
}));

import * as docs from "@/app/api/app/documents/route";
import * as consent from "@/app/api/app/documents/consent/route";
import * as one from "@/app/api/app/documents/[id]/route";
import * as advance from "@/app/api/app/documents/[id]/advance/route";
import { checkPdfUpload, mapDocFailure, DOCS_COOKIE } from "@/server/backend/documents";
import { MAX_UPLOAD_BYTES } from "@/adapters/documents-contract";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Reply = { status: number; body: unknown };
let calls: Call[];
let routes: Record<string, Reply | (() => Reply)>;
let down = false;

const pdf = (n = 64) => {
  const b = new Uint8Array(n);
  b.set(new TextEncoder().encode("%PDF-1.7\n"));
  return b;
};
const req = (path: string, method = "GET", o: { body?: BodyInit; headers?: Record<string, string> } = {}) =>
  new Request(`http://app.test${path}`, { method, headers: { host: "app.test", "x-knowvia-app": "1", ...o.headers }, body: o.body });
const upload = (bytes: Uint8Array = pdf(), headers: Record<string, string> = {}) =>
  req("/api/app/documents", "POST", {
    body: bytes as unknown as BodyInit,
    headers: { "content-type": "application/pdf", "x-filename": encodeURIComponent("my policy.pdf"), "x-document-kind": "policy_wording", "idempotency-key": "key-12345678", ...headers },
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const DOC = { id: "doc-1", documentKind: "policy_wording", byteSize: 64, status: "accepted", uploadedAt: new Date().toISOString() };
const bk = (code: string) => ({ error: { code, message: "backend words that must not leak" } });

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  jar.clear();
  jar.set("kv_session", seal({ t: "tok-secret", h: "h1", m: "m1", a: "adult1", exp: Date.now() + 60_000 }, SECRET));
  calls = [];
  down = false;
  routes = {
    "POST /api/v1/cases": { status: 201, body: { id: "case-1" } },
    "POST /api/v1/consents": { status: 201, body: { id: "consent-1" } },
    "POST /api/v1/cases/case-1/documents": { status: 201, body: { document: DOC } },
    "GET /api/v1/cases/case-1/documents": { status: 200, body: { caseId: "case-1", documents: [DOC] } },
    "GET /api/v1/documents/doc-1": { status: 200, body: DOC },
    "POST /api/v1/documents/doc-1/ocr-jobs": { status: 200, body: { job: { status: "succeeded", errorCode: null } } },
    "POST /api/v1/cases/case-1/analysis-runs": { status: 202, body: { id: "run-1" } },
    "POST /api/v1/documents/doc-1/structuring-runs": { status: 200, body: { structuring: { status: "finished", evidenceOutcome: "complete" } } },
    "DELETE /api/v1/documents/doc-1": { status: 200, body: { document: { ...DOC, status: "deleted" } } },
    "POST /api/v1/consents/consent-1/revoke": { status: 200, body: {} },
  };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (down) throw new TypeError("network");
    const u = new URL(url);
    const method = init.method ?? "GET";
    calls.push({ url: u.pathname, method, headers: init.headers as Record<string, string>, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
    const r = routes[`${method} ${u.pathname}`];
    const reply = typeof r === "function" ? r() : r ?? { status: 404, body: bk("CASE_NOT_FOUND") };
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
});
afterEach(() => vi.unstubAllGlobals());

const grant = () => consent.POST(req("/api/app/documents/consent", "POST", { body: JSON.stringify({ accept: true, requestId: "req-12345678" }), headers: { "content-type": "application/json" } }));

describe("consent", () => {
  it("creates the exact collect grant with an idempotency key and the session's adult", async () => {
    const res = await grant();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, consent: true });
    const c = calls[0];
    expect(c.url).toBe("/api/v1/consents");
    expect(c.headers["idempotency-key"]).toBe("collect-req-12345678");
    expect(c.headers.authorization).toBe("Bearer tok-secret");
    expect(c.body).toMatchObject({
      householdId: "h1", subjectAdultId: "adult1", purpose: "document_processing",
      scopes: [{ resourceType: "document", resourceId: null, action: "collect", dataCategory: "insurance_document" }],
    });
    expect(jar.has(DOCS_COOKIE)).toBe(true);
  });
  it("refuses a bad body and a session without an adult id", async () => {
    const bad = await consent.POST(req("/api/app/documents/consent", "POST", { body: JSON.stringify({ accept: false }), headers: { "content-type": "application/json" } }));
    expect(bad.status).toBe(400);
    jar.set("kv_session", seal({ t: "t", h: "h1", m: "m1", exp: Date.now() + 60_000 }, SECRET));
    expect((await grant()).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("revokes every grant and clears the document state", async () => {
    await grant();
    const res = await consent.DELETE(req("/api/app/documents/consent", "DELETE"));
    expect(res.status).toBe(200);
    expect(calls.at(-1)?.url).toBe("/api/v1/consents/consent-1/revoke");
    const list = await (await docs.GET(req("/api/app/documents"))).json();
    expect(list.consent).toBe(false);
  });
  it("keeps a grant it could not revoke and says so", async () => {
    await grant();
    routes["POST /api/v1/consents/consent-1/revoke"] = { status: 503, body: null };
    const res = await consent.DELETE(req("/api/app/documents/consent", "DELETE"));
    expect(res.status).toBe(502);
    expect((await res.json()).retryable).toBe(true);
    routes["POST /api/v1/consents/consent-1/revoke"] = { status: 200, body: {} };
    const again = await consent.DELETE(req("/api/app/documents/consent", "DELETE"));
    expect(again.status).toBe(200);
  });
});

describe("upload", () => {
  it("refuses without consent and never calls the backend", async () => {
    const res = await docs.POST(upload());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CONSENT_REQUIRED");
    expect(calls).toHaveLength(0);
  });
  it("creates the case once, forwards the bytes with the grant, kind, key and name", async () => {
    await grant();
    calls = [];
    const res = await docs.POST(upload());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.document.steps).toMatchObject({ uploaded: "done", scanned: "done" });
    expect(JSON.stringify(body)).not.toContain("tok-secret");
    const up = calls.find((c) => c.url.endsWith("/documents") && c.method === "POST")!;
    expect(up.headers).toMatchObject({ "x-consent-grant-id": "consent-1", "x-document-kind": "policy_wording", "idempotency-key": "key-12345678", "x-filename": "my%20policy.pdf", "content-type": "application/pdf" });
    expect(calls.filter((c) => c.url === "/api/v1/cases")).toHaveLength(1);
    calls = [];
    await docs.POST(upload(pdf(65), { "idempotency-key": "key-87654321" }));
    expect(calls.filter((c) => c.url === "/api/v1/cases")).toHaveLength(0);
  });
  it("rejects a non-PDF type, wrong signature, empty and oversize files before the backend", async () => {
    await grant();
    calls = [];
    expect((await docs.POST(upload(pdf(), { "content-type": "image/png" }))).status).toBe(415);
    const text = new TextEncoder().encode("not a pdf at all");
    const wrong = await docs.POST(upload(text));
    expect(wrong.status).toBe(415);
    expect((await wrong.json()).code).toBe("FILE_TYPE_INVALID");
    expect((await (await docs.POST(upload(new Uint8Array(0)))).json()).code).toBe("FILE_EMPTY");
    const big = await docs.POST(upload(pdf(MAX_UPLOAD_BYTES + 1)));
    expect(big.status).toBe(413);
    expect((await big.json()).code).toBe("FILE_TOO_LARGE");
    const declared = await docs.POST(upload(pdf(), { "content-length": String(MAX_UPLOAD_BYTES + 10) }));
    expect(declared.status).toBe(413);
    expect(calls).toHaveLength(0);
  });
  it("rejects an unknown kind and a bad key", async () => {
    await grant();
    expect((await docs.POST(upload(pdf(), { "x-document-kind": "medical_record" }))).status).toBe(400);
    expect((await docs.POST(upload(pdf(), { "idempotency-key": "short" }))).status).toBe(400);
  });
  it("maps backend codes to client-safe codes without leaking backend words", async () => {
    await grant();
    const cases: [number, string, string, number][] = [
      [409, "DUPLICATE_DOCUMENT", "DUPLICATE_DOCUMENT", 409],
      [422, "PDF_PASSWORD_REQUIRED", "PDF_PROTECTED", 422],
      [422, "PDF_ACTIVE_CONTENT", "PDF_UNREADABLE", 422],
      [503, "DOCUMENT_STORAGE_NOT_CONFIGURED", "UPLOAD_UNAVAILABLE", 503],
      [429, "UPLOAD_CAPACITY_REACHED", "RATE_LIMITED", 429],
    ];
    for (const [status, backend, code, out] of cases) {
      routes["POST /api/v1/cases/case-1/documents"] = { status, body: bk(backend) };
      const res = await docs.POST(upload());
      expect(res.status).toBe(out);
      const text = await res.text();
      expect(JSON.parse(text).code).toBe(code);
      expect(text).not.toContain("backend words");
    }
  });
  it("forgets a grant the backend refuses, so the page asks again", async () => {
    await grant();
    routes["POST /api/v1/cases/case-1/documents"] = { status: 403, body: bk("ACTIVE_CONSENT_REQUIRED") };
    expect((await (await docs.POST(upload())).json()).code).toBe("CONSENT_REQUIRED");
    expect((await (await docs.GET(req("/api/app/documents"))).json()).consent).toBe(false);
  });
  it("answers a coded retryable error when the backend is down", async () => {
    await grant();
    down = true;
    const res = await docs.POST(upload());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, code: "BACKEND_UNREACHABLE", retryable: true });
  });
  it("needs the app header and a session", async () => {
    const noHeader = new Request("http://app.test/api/app/documents", { method: "POST", headers: { host: "app.test", "content-type": "application/pdf" }, body: pdf() as unknown as BodyInit });
    expect((await docs.POST(noHeader)).status).toBe(403);
    jar.delete("kv_session");
    expect((await docs.POST(upload())).status).toBe(401);
  });
});

describe("status, advance, delete", () => {
  it("lists documents and derives the steps", async () => {
    await grant();
    await docs.POST(upload());
    const list = await (await docs.GET(req("/api/app/documents"))).json();
    expect(list.consent).toBe(true);
    expect(list.documents[0]).toMatchObject({ id: "doc-1", steps: { scanned: "done", reading: "active" }, busy: true });
  });
  it("lists nothing before a case exists", async () => {
    expect(await (await docs.GET(req("/api/app/documents"))).json()).toEqual({ ok: true, consent: false, documents: [] });
  });
  it("waits while the scan is pending and marks the file quarantined when the scan does not come", async () => {
    await grant();
    await docs.POST(upload());
    routes["GET /api/v1/documents/doc-1"] = { status: 200, body: { ...DOC, status: "received_pending_checks" } };
    const early = await (await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"))).json();
    expect(early.document.steps.scanned).toBe("active");
    expect(calls.some((c) => c.url.includes("ocr-jobs"))).toBe(false);
    routes["GET /api/v1/documents/doc-1"] = { status: 200, body: { ...DOC, status: "received_pending_checks", uploadedAt: new Date(Date.now() - 10 * 60_000).toISOString() } };
    const late = await (await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"))).json();
    expect(late.document).toMatchObject({ note: "QUARANTINED", steps: { scanned: "unavailable" } });
  });
  it("reads, then structures, then is done", async () => {
    await grant();
    await docs.POST(upload());
    calls = [];
    const res = await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"));
    const d = (await res.json()).document;
    expect(d.steps).toEqual({ uploaded: "done", scanned: "done", reading: "done", structured: "done" });
    expect(d.busy).toBe(false);
    const ocrGrant = calls.find((c) => c.url === "/api/v1/consents" && (c.body as { grantedToActor?: string }).grantedToActor === "sarvam")!;
    expect(ocrGrant.body).toMatchObject({ scopes: [{ resourceType: "document", resourceId: "doc-1", action: "derive", recipient: "sarvam" }] });
    const gemini = calls.find((c) => c.url === "/api/v1/consents" && (c.body as { grantedToActor?: string }).grantedToActor === "google-gemini")!;
    expect(gemini.body).toMatchObject({ scopes: [{ resourceId: "doc-1", recipient: "google-gemini" }] });
    expect(calls.find((c) => c.url.endsWith("structuring-runs"))?.body).toMatchObject({ workflowRunId: "run-1", restart: false });
  });
  it("shows reading as running while the OCR job is, and does not repeat finished work", async () => {
    await grant();
    await docs.POST(upload());
    routes["POST /api/v1/documents/doc-1/ocr-jobs"] = { status: 202, body: { job: { status: "running", errorCode: null } } };
    const r1 = (await (await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"))).json()).document;
    expect(r1.steps.reading).toBe("active");
    routes["POST /api/v1/documents/doc-1/ocr-jobs"] = { status: 200, body: { job: { status: "succeeded", errorCode: null } } };
    await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"));
    calls = [];
    await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"));
    expect(calls.filter((c) => c.url.includes("ocr-jobs"))).toHaveLength(0);
  });
  it("marks reading unavailable when the provider is off, and retries on request", async () => {
    await grant();
    await docs.POST(upload());
    routes["POST /api/v1/documents/doc-1/ocr-jobs"] = { status: 503, body: bk("OCR_PROVIDER_DISABLED") };
    const d = (await (await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"))).json()).document;
    expect(d).toMatchObject({ note: "READING_UNAVAILABLE", steps: { reading: "unavailable" }, busy: false });
    calls = [];
    await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"));
    expect(calls.filter((c) => c.url.includes("ocr-jobs"))).toHaveLength(0);
    routes["POST /api/v1/documents/doc-1/ocr-jobs"] = { status: 200, body: { job: { status: "failed", errorCode: "OCR_PROVIDER_FAILED" } } };
    const retried = (await (await advance.POST(req("/api/app/documents/doc-1/advance", "POST", { body: JSON.stringify({ retry: true }), headers: { "content-type": "application/json" } }), params("doc-1"))).json()).document;
    expect(retried.note).toBe("READING_FAILED");
    expect(calls.find((c) => c.url.includes("ocr-jobs"))?.body).toMatchObject({ retryFailed: true });
  });
  it("keeps the reading when structuring is not available", async () => {
    await grant();
    await docs.POST(upload());
    routes["POST /api/v1/documents/doc-1/structuring-runs"] = { status: 503, body: bk("STRUCTURING_DISABLED") };
    const d = (await (await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"))).json()).document;
    expect(d.steps).toMatchObject({ reading: "done", structured: "unavailable" });
    expect(d.note).toBe("STRUCTURING_UNAVAILABLE");
  });
  it("refuses to read without consent", async () => {
    const res = await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CONSENT_REQUIRED");
    expect(calls.some((c) => c.url.includes("ocr-jobs"))).toBe(false);
  });
  it("answers 404 for another household's or a missing document, with no backend words", async () => {
    await grant();
    routes["GET /api/v1/documents/other"] = { status: 404, body: bk("DOCUMENT_NOT_FOUND") };
    for (const call of [
      () => one.GET(req("/api/app/documents/other"), params("other")),
      () => one.DELETE(req("/api/app/documents/other", "DELETE"), params("other")),
      () => advance.POST(req("/api/app/documents/other/advance", "POST"), params("other")),
    ]) {
      const res = await call();
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", retryable: false });
    }
  });
  it("rejects an odd document id before the backend", async () => {
    const res = await one.GET(req("/api/app/documents/x"), params("../etc"));
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });
  it("deletes a document and forgets its progress", async () => {
    await grant();
    await docs.POST(upload());
    await advance.POST(req("/api/app/documents/doc-1/advance", "POST"), params("doc-1"));
    const res = await one.DELETE(req("/api/app/documents/doc-1", "DELETE"), params("doc-1"));
    expect(res.status).toBe(200);
    expect(calls.at(-1)).toMatchObject({ method: "DELETE", url: "/api/v1/documents/doc-1" });
  });
});

describe("helpers", () => {
  it("checkPdfUpload accepts a PDF with a charset parameter", () => {
    expect(() => checkPdfUpload({ contentType: "application/pdf; charset=binary", declaredLength: 10, bytes: pdf() })).not.toThrow();
  });
  it("mapDocFailure falls back by status and never copies backend text", () => {
    expect(mapDocFailure(404, null).code).toBe("NOT_FOUND");
    expect(mapDocFailure(401, null).code).toBe("UNAUTHENTICATED");
    expect(mapDocFailure(500, bk("X_Y")).retryable).toBe(true);
    expect(mapDocFailure(409, bk("DOCUMENT_NOT_OCR_READY")).code).toBe("NOT_READY");
  });
  it("ignores state sealed for another household", async () => {
    await grant();
    jar.set("kv_session", seal({ t: "tok-secret", h: "h2", m: "m1", a: "adult1", exp: Date.now() + 60_000 }, SECRET));
    expect((await (await docs.GET(req("/api/app/documents"))).json()).consent).toBe(false);
  });
});
