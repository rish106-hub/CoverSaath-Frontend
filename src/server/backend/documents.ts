import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { del, get, list as listBlobs } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { z } from "zod";
import { AppError } from "./errors";
import { assertSameOrigin } from "./guard";
import { runtime, readSession, json, failure } from "./index";
import { openValue, sealValue, type SessionPayload } from "./session";
import type { FetchLike } from "./client";
import { guardedFetch } from "./resilience";
import { BLOB_NAME, BLOB_TOKEN_TTL_MS, DOCUMENT_KINDS, MAX_LARGE_UPLOAD_BYTES, MAX_UPLOAD_BYTES, deriveView, type DocView, type ProgressCode } from "@/adapters/documents-contract";

// BFF for the evidence pipeline: case, reading consent, upload, scan, OCR, structuring, delete, revoke (CoverSaath /api/v1).
// Server only. The backend token stays in the sealed session cookie. The backend has no route that lists cases or consent grants,
// so the ids this flow needs live in a second sealed cookie (kv_docs). Legal review: consent purposes and recipients are not final.

export const DOCS_COOKIE = "kv_docs";
const MAX_TRACKED = 6;

// ---- Errors --------------------------------------------------------------------------------------------------------------

const BY_CODE: Record<string, [number, AppError["code"], boolean]> = {
  ACTIVE_CONSENT_REQUIRED: [403, "CONSENT_REQUIRED", false],
  CONSENT_REQUIRED: [403, "CONSENT_REQUIRED", false],
  CONSENT_SCOPE_REQUIRED: [403, "CONSENT_REQUIRED", false],
  CONSENT_REVOKED: [403, "CONSENT_REQUIRED", false],
  CONSENT_EXPIRED: [403, "CONSENT_REQUIRED", false],
  DUPLICATE_DOCUMENT: [409, "DUPLICATE_DOCUMENT", false],
  DOCUMENT_VERSION_EXISTS: [409, "DUPLICATE_DOCUMENT", false],
  FILE_TOO_LARGE: [413, "FILE_TOO_LARGE", false],
  PDF_PASSWORD_REQUIRED: [422, "PDF_PROTECTED", false],
  FIELD_ACCESS_REQUIRED: [403, "CONSENT_REQUIRED", false],
  PDF_STRUCTURE_INVALID: [422, "PDF_UNREADABLE", false],
  PDF_INSPECTION_FAILED: [422, "PDF_UNREADABLE", false],
  PDF_ACTIVE_CONTENT: [422, "PDF_ACTIVE_CONTENT", false],
  PDF_PAGE_LIMIT: [422, "PDF_TOO_LONG", false],
  PDF_RESOURCE_LIMIT: [422, "PDF_TOO_COMPLEX", false],
  PDF_UNSUPPORTED_ENCODING: [422, "PDF_TOO_COMPLEX", false],
  PDF_INSPECTION_BUSY: [429, "BACKEND_BUSY", true],
  PDF_INSPECTION_UNAVAILABLE: [503, "BACKEND_BUSY", true],
  DOCUMENT_SCANNER_NOT_CONFIGURED: [503, "UPLOAD_UNAVAILABLE", false],
  EMPTY_FILE: [400, "FILE_EMPTY", false],
  MIME_MISMATCH: [415, "FILE_TYPE_INVALID", false],
  EXTENSION_MISMATCH: [415, "FILE_TYPE_INVALID", false],
  CASE_NOT_FOUND: [404, "NOT_FOUND", false],
  DOCUMENT_NOT_FOUND: [404, "NOT_FOUND", false],
  DOCUMENT_STORAGE_NOT_CONFIGURED: [503, "UPLOAD_UNAVAILABLE", false],
  UPLOAD_CAPACITY_REACHED: [429, "RATE_LIMITED", true],
  CASE_CAPACITY_REACHED: [429, "RATE_LIMITED", true],
  ANALYSIS_CAPACITY_REACHED: [429, "RATE_LIMITED", true],
  OCR_PROVIDER_DISABLED: [503, "READING_UNAVAILABLE", false],
  STRUCTURING_DISABLED: [503, "READING_UNAVAILABLE", false],
  STRUCTURING_BUSY: [503, "BACKEND_BUSY", true],
  DOCUMENT_NOT_OCR_READY: [409, "NOT_READY", true],
};

function backendCode(body: unknown): string | null {
  const c = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof c === "string" ? c : null;
}

/** A failed backend answer becomes a coded, client-safe error. Only the code and status are read; the message never leaves. */
export function mapDocFailure(status: number, body: unknown): AppError {
  const known = BY_CODE[backendCode(body) ?? ""];
  if (known) return new AppError(known[0], known[1], known[2]);
  if (status === 401) return new AppError(401, "UNAUTHENTICATED");
  if (status === 403) return new AppError(403, "FORBIDDEN");
  if (status === 404) return new AppError(404, "NOT_FOUND");
  if (status === 413) return new AppError(413, "FILE_TOO_LARGE");
  if (status === 429) return new AppError(429, "RATE_LIMITED", true);
  if (status >= 500) return new AppError(502, "BACKEND_UNREACHABLE", true);
  if (status === 400 || status === 422) return new AppError(400, "INVALID_INPUT");
  return new AppError(502, "BACKEND_REJECTED");
}

// ---- Upload validation (before a byte goes to the backend) -------------------------------------------------------------------

/** Type, size and signature checks. The backend inspects the PDF again; this stops obvious misses at the edge. */
export function checkPdfUpload(o: { contentType: string | null; declaredLength: number | null; bytes?: Uint8Array; max?: number }): void {
  const max = o.max ?? MAX_UPLOAD_BYTES;
  const type = (o.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/pdf") throw new AppError(415, "FILE_TYPE_INVALID");
  if (o.declaredLength !== null && o.declaredLength > max) throw new AppError(413, "FILE_TOO_LARGE");
  if (!o.bytes) return;
  if (o.bytes.byteLength === 0) throw new AppError(400, "FILE_EMPTY");
  if (o.bytes.byteLength > max) throw new AppError(413, "FILE_TOO_LARGE");
  const head = Buffer.from(o.bytes.subarray(0, 5)).toString("latin1");
  if (head !== "%PDF-") throw new AppError(415, "FILE_TYPE_INVALID");
}

const keyPattern = /^[A-Za-z0-9_-]{8,100}$/;

// ---- Backend client ----------------------------------------------------------------------------------------------------------

type Out = { status: number; body: unknown };
const idOnly = z.object({ id: z.string().min(1) }).loose();
const docDto = z.object({
  id: z.string(), documentKind: z.string(), byteSize: z.number(), status: z.string(), uploadedAt: z.string().nullish(),
}).loose();
type BackendDocDto = z.infer<typeof docDto>;

export function createDocumentsClient(opts: { baseUrl: string; fetch?: FetchLike }) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = opts.fetch ?? guardedFetch;

  async function send(method: "GET" | "POST" | "DELETE", path: string, token: string, o: { json?: unknown; headers?: Record<string, string>; bytes?: Uint8Array; timeoutMs?: number } = {}): Promise<Out> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), o.timeoutMs ?? 8000);
    const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}`, ...o.headers };
    let body: BodyInit | undefined;
    if (o.bytes) {
      headers["content-type"] = "application/pdf";
      body = Buffer.from(o.bytes);
    } else if (o.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(o.json);
    }
    try {
      const res = await doFetch(`${base}${path}`, { method, headers, body, signal: controller.signal, cache: "no-store", redirect: "error" });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        if (res.ok) throw new AppError(502, "BACKEND_BAD_RESPONSE");
      }
      if (res.status < 200 || res.status >= 300) throw mapDocFailure(res.status, parsed);
      return { status: res.status, body: parsed };
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (controller.signal.aborted) throw new AppError(504, "BACKEND_TIMEOUT", true);
      throw new AppError(503, "BACKEND_UNREACHABLE", true);
    } finally {
      clearTimeout(timer);
    }
  }

  const parse = <T>(schema: z.ZodType<T>, v: unknown): T => {
    const r = schema.safeParse(v);
    if (!r.success) throw new AppError(502, "BACKEND_BAD_RESPONSE");
    return r.data;
  };
  const idem = (key: string) => ({ "idempotency-key": key });

  return {
    async createCase(token: string, householdId: string): Promise<string> {
      const r = await send("POST", "/api/v1/cases", token, { json: { householdId, triggerType: "user_requested_review" } });
      return parse(idOnly, r.body).id;
    },
    /** Replay-safe: the same key returns the same grant. */
    async grant(token: string, g: { householdId: string; adultId: string; key: string; purpose: string; grantedToActor?: string; scope: { resourceType: string; resourceId: string | null; action: string; dataCategory: string; recipient?: string } }): Promise<string> {
      const r = await send("POST", "/api/v1/consents", token, {
        headers: idem(g.key),
        json: { householdId: g.householdId, subjectAdultId: g.adultId, purpose: g.purpose, ...(g.grantedToActor ? { grantedToActor: g.grantedToActor } : {}), evidenceMethod: "typed", scopes: [g.scope] },
      });
      return parse(idOnly, r.body).id;
    },
    async refreshOcr(token: string, jobId: string, consentGrantId: string): Promise<{ status: string; errorCode: string | null }> {
      const r = await send("POST", `/api/v1/ocr-jobs/${encodeURIComponent(jobId)}/refresh`, token, { json: { consentGrantId }, timeoutMs: 15_000 });
      const job = parse(z.object({ job: z.object({ status: z.string(), errorCode: z.string().nullish() }).loose() }), r.body).job;
      return { status: job.status, errorCode: job.errorCode ?? null };
    },
    async revokeGrant(token: string, grantId: string): Promise<void> {
      await send("POST", `/api/v1/consents/${encodeURIComponent(grantId)}/revoke`, token, { json: { reason: "withdrawn_by_person" } });
    },
    async upload(token: string, a: { caseId: string; consentGrantId: string; kind: string; filename: string; key: string; bytes: Uint8Array }): Promise<BackendDocDto> {
      const r = await send("POST", `/api/v1/cases/${encodeURIComponent(a.caseId)}/documents`, token, {
        bytes: a.bytes,
        timeoutMs: 25_000,
        headers: { ...idem(a.key), "x-document-kind": a.kind, "x-consent-grant-id": a.consentGrantId, "x-filename": encodeURIComponent(a.filename) },
      });
      return parse(z.object({ document: docDto }), r.body).document;
    },
    async list(token: string, caseId: string): Promise<BackendDocDto[]> {
      const r = await send("GET", `/api/v1/cases/${encodeURIComponent(caseId)}/documents`, token);
      return parse(z.object({ documents: z.array(docDto) }), r.body).documents;
    },
    async get(token: string, documentId: string): Promise<BackendDocDto> {
      return parse(docDto, (await send("GET", `/api/v1/documents/${encodeURIComponent(documentId)}`, token)).body);
    },
    async remove(token: string, documentId: string): Promise<void> {
      await send("DELETE", `/api/v1/documents/${encodeURIComponent(documentId)}`, token);
    },
    async startOcr(token: string, documentId: string, consentGrantId: string, retry: boolean): Promise<{ id: string | null; status: string; errorCode: string | null }> {
      const r = await send("POST", `/api/v1/documents/${encodeURIComponent(documentId)}/ocr-jobs`, token, { json: { consentGrantId, retryFailed: retry }, timeoutMs: 15_000 });
      const job = parse(z.object({ job: z.object({ id: z.string().nullish(), status: z.string(), errorCode: z.string().nullish() }).loose() }), r.body).job;
      return { id: job.id ?? null, status: job.status, errorCode: job.errorCode ?? null };
    },
    async startAnalysisRun(token: string, caseId: string, consentGrantId: string, key: string): Promise<string> {
      const r = await send("POST", `/api/v1/cases/${encodeURIComponent(caseId)}/analysis-runs`, token, {
        headers: idem(key), json: { consentGrantId, executionMode: "fixture", modelPermission: false }, timeoutMs: 15_000,
      });
      return parse(idOnly, r.body).id;
    },
    async startStructuring(token: string, documentId: string, a: { workflowRunId: string; consentGrantId: string; restart: boolean }): Promise<{ status: string; evidenceOutcome: string | null }> {
      const r = await send("POST", `/api/v1/documents/${encodeURIComponent(documentId)}/structuring-runs`, token, { json: a, timeoutMs: 15_000 });
      const s = parse(z.object({ structuring: z.object({ status: z.string(), evidenceOutcome: z.string().nullish() }).loose() }), r.body).structuring;
      return { status: s.status, evidenceOutcome: s.evidenceOutcome ?? null };
    },
  };
}
export type DocumentsClient = ReturnType<typeof createDocumentsClient>;

// ---- Sealed state (kv_docs) --------------------------------------------------------------------------------------------------

type DocState = { s?: string; m?: string; cg?: string; w?: string; r?: ProgressCode; t?: ProgressCode };
/** c case, g reading grant, v case read grant (lets the owner read the case's source list), d per-document ids and progress, x grants whose revoke has not gone through yet. */
export type DocsState = { h: string; exp: number; c?: string; g?: string; v?: string; x?: string[]; d: Record<string, DocState> };

export async function readDocsState(secret: string, session: SessionPayload): Promise<DocsState> {
  const v = openValue<DocsState>((await cookies()).get(DOCS_COOKIE)?.value, secret);
  // State from another household or session is never reused.
  if (!v || v.h !== session.h || typeof v.d !== "object" || v.d === null) return { h: session.h, exp: session.exp, d: {} };
  return { ...v, exp: session.exp };
}

export async function writeDocsState(state: DocsState, secret: string): Promise<void> {
  const ids = Object.keys(state.d);
  const d = Object.fromEntries(ids.slice(-MAX_TRACKED).map((id) => [id, state.d[id]]));
  (await cookies()).set(DOCS_COOKIE, sealValue({ ...state, d }, secret), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    maxAge: Math.max(60, Math.floor((state.exp - Date.now()) / 1000)),
  });
}

// ---- Operations --------------------------------------------------------------------------------------------------------------

export type Ctx = { client: DocumentsClient; session: SessionPayload; state: DocsState; secret: string };

const need = (s: SessionPayload): string => {
  if (!s.a) throw new AppError(401, "UNAUTHENTICATED"); // session made before documents existed: sign in again
  return s.a;
};

const viewOf = (doc: BackendDocDto, state: DocsState): DocView => deriveView(doc, state.d[doc.id]?.r ?? "none", state.d[doc.id]?.t ?? "none");

export async function grantReadingConsent(ctx: Ctx, requestId: string): Promise<{ consent: boolean }> {
  const adultId = need(ctx.session);
  // DRAFT for legal review. Covers storing the file here (document_processing / collect). Reading and structuring grants are made per document.
  const id = await ctx.client.grant(ctx.session.t, {
    householdId: ctx.session.h, adultId, key: `collect-${requestId}`, purpose: "document_processing",
    scope: { resourceType: "document", resourceId: null, action: "collect", dataCategory: "insurance_document" },
  });
  ctx.state.g = id;
  await writeDocsState(ctx.state, ctx.secret);
  return { consent: true };
}

export async function revokeReadingConsent(ctx: Ctx): Promise<{ consent: boolean }> {
  need(ctx.session);
  const ids = [...(ctx.state.x ?? [])];
  if (ctx.state.g) ids.push(ctx.state.g);
  if (ctx.state.v) ids.push(ctx.state.v);
  for (const e of Object.values(ctx.state.d)) ids.push(...[e.s, e.m, e.cg].filter((x): x is string => Boolean(x)));
  const left: string[] = [];
  for (const id of ids) {
    try {
      await ctx.client.revokeGrant(ctx.session.t, id);
    } catch (e) {
      // A grant the backend no longer knows is already gone. Anything else is kept so a retry can revoke it.
      if (!(e instanceof AppError && e.code === "NOT_FOUND")) left.push(id);
    }
  }
  ctx.state.g = undefined;
  ctx.state.v = undefined;
  ctx.state.d = {};
  ctx.state.x = left.length > 0 ? left : undefined;
  await writeDocsState(ctx.state, ctx.secret);
  if (left.length > 0) throw new AppError(502, "BACKEND_UNREACHABLE", true);
  return { consent: false };
}

/**
 * The backend gates every read of a case's documents (list, one document, readings) on a consent of its own: purpose
 * document_processing, scope case/<id>/read/source_pack_metadata, recipient the viewer. The collect grant does not cover it.
 * Made once per case and consent generation, with a replay-safe key, tracked in state.v and revoked on withdrawal.
 * `renew` makes a fresh grant when the backend still refuses the one we hold.
 */
export async function ensureReadGrant(ctx: Ctx, renew = false): Promise<void> {
  if (!ctx.state.c || !ctx.state.g || (ctx.state.v && !renew)) return;
  const adultId = need(ctx.session);
  const c = ctx.state.c;
  ctx.state.v = await ctx.client.grant(ctx.session.t, {
    householdId: ctx.session.h, adultId, key: `view-${c}-${gen(ctx.state)}${renew ? `-${Date.now().toString(36)}` : ""}`, purpose: "document_processing",
    scope: { resourceType: "case", resourceId: c, action: "read", dataCategory: "source_pack_metadata", recipient: adultId },
  });
  await writeDocsState(ctx.state, ctx.secret);
}

/** Runs a case read; if the backend says the read grant is missing, makes a fresh one and tries once more. */
async function withReadGrant<T>(ctx: Ctx, run: () => Promise<T>): Promise<T> {
  await ensureReadGrant(ctx);
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof AppError && e.code === "CONSENT_REQUIRED" && ctx.state.g && ctx.state.c)) throw e;
    await ensureReadGrant(ctx, true);
    return await run();
  }
}

export async function listDocuments(ctx: Ctx): Promise<{ consent: boolean; documents: DocView[]; largeUpload: boolean }> {
  const consent = Boolean(ctx.state.g);
  const largeUpload = largeUploadEnabled();
  if (!ctx.state.c) return { consent, documents: [], largeUpload };
  const c = ctx.state.c;
  const docs = await withReadGrant(ctx, () => ctx.client.list(ctx.session.t, c));
  return { consent, documents: docs.filter((d) => d.status !== "deleted").map((d) => viewOf(d, ctx.state)), largeUpload };
}

export async function uploadDocument(ctx: Ctx, f: { kind: string; filename: string; key: string; bytes: Uint8Array }): Promise<DocView> {
  need(ctx.session);
  if (!ctx.state.g) throw new AppError(403, "CONSENT_REQUIRED");
  if (!(DOCUMENT_KINDS as readonly string[]).includes(f.kind) || !keyPattern.test(f.key)) throw new AppError(400, "INVALID_INPUT");
  if (!ctx.state.c) {
    ctx.state.c = await ctx.client.createCase(ctx.session.t, ctx.session.h);
    await writeDocsState(ctx.state, ctx.secret);
  }
  await ensureReadGrant(ctx);
  try {
    const doc = await ctx.client.upload(ctx.session.t, { caseId: ctx.state.c, consentGrantId: ctx.state.g, kind: f.kind, filename: f.filename, key: f.key, bytes: f.bytes });
    return viewOf(doc, ctx.state);
  } catch (e) {
    // The backend no longer honours the grant (withdrawn, expired): forget it so the page asks again.
    if (e instanceof AppError && e.code === "CONSENT_REQUIRED") {
      ctx.state.g = undefined;
      await writeDocsState(ctx.state, ctx.secret);
    }
    throw e;
  }
}

// ---- Large PDFs (Vercel Blob handoff, docs/upload-large-pdf.md) --------------------------------------------------------------
// The browser uploads straight to a private Blob store with a short-lived token from this server. The server then reads the blob,
// checks it, sends it to the backend as usual and deletes the blob in a finally block, on success and on failure.

/** Large uploads need a Blob store. Without BLOB_READ_WRITE_TOKEN the 4 MB direct path is the only one. */
export const largeUploadEnabled = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
/** A blob older than this was never claimed (the browser stopped after uploading). It is swept on the next token request. */
const STALE_BLOB_MS = 30 * 60_000;

/** The household's blob folder. Hashed, so no household id appears in a path. */
export const blobPrefix = (session: SessionPayload): string => `uploads/${createHash("sha256").update(session.h).digest("hex").slice(0, 24)}/`;

function assertBlobPath(session: SessionPayload, pathname: unknown): asserts pathname is string {
  const prefix = blobPrefix(session);
  if (typeof pathname !== "string" || !pathname.startsWith(prefix) || !BLOB_NAME.test(pathname.slice(prefix.length))) throw new AppError(400, "INVALID_INPUT");
}

/** Large-upload calls need a real signed-in person (never the demo), a configured store, and the reading go-ahead. */
function assertLargeUpload(ctx: Ctx): void {
  if (ctx.session.d) throw new AppError(403, "FORBIDDEN");
  need(ctx.session);
  if (!largeUploadEnabled()) throw new AppError(503, "UPLOAD_UNAVAILABLE");
  if (!ctx.state.g) throw new AppError(403, "CONSENT_REQUIRED");
}

/** The folder the browser must upload into. Also how the page learns a Blob store exists. */
export function blobInfo(ctx: Ctx): { prefix: string } {
  assertLargeUpload(ctx);
  return { prefix: blobPrefix(ctx.session) };
}

async function sweepStale(prefix: string): Promise<void> {
  try {
    const { blobs } = await listBlobs({ prefix, limit: 100 });
    const old = blobs.filter((b) => Date.now() - new Date(b.uploadedAt).getTime() > STALE_BLOB_MS).map((b) => b.url);
    if (old.length > 0) await del(old);
  } catch {
    // Best effort: a failed sweep never blocks an upload.
  }
}

/** Answers the Blob client's token request. Only token requests are served: nothing here accepts a completion callback. */
export async function issueBlobToken(ctx: Ctx, req: Request): Promise<{ type: string; clientToken?: string }> {
  assertLargeUpload(ctx);
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body || body.type !== "blob.generate-client-token") throw new AppError(400, "INVALID_INPUT");
  await sweepStale(blobPrefix(ctx.session));
  return handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      assertBlobPath(ctx.session, pathname);
      return {
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: MAX_LARGE_UPLOAD_BYTES,
        validUntil: Date.now() + BLOB_TOKEN_TTL_MS,
        addRandomSuffix: false,
        allowOverwrite: false,
      };
    },
  }) as Promise<{ type: string; clientToken?: string }>;
}

async function readCapped(stream: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new AppError(413, "FILE_TOO_LARGE");
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

/** Reads the blob the browser uploaded, runs the same checks as the direct path, hands it to the backend and always deletes the blob. */
export async function uploadFromBlob(ctx: Ctx, f: { pathname: string; kind: string; filename: string; key: string }): Promise<DocView> {
  assertLargeUpload(ctx);
  // Checked before anything is read or deleted, so another household's blob can never be touched.
  assertBlobPath(ctx.session, f.pathname);
  try {
    const res = await get(f.pathname, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) throw new AppError(404, "BLOB_MISSING", true);
    const contentType = res.blob.contentType;
    checkPdfUpload({ contentType, declaredLength: res.blob.size, max: MAX_LARGE_UPLOAD_BYTES });
    const bytes = await readCapped(res.stream, MAX_LARGE_UPLOAD_BYTES);
    checkPdfUpload({ contentType, declaredLength: null, bytes, max: MAX_LARGE_UPLOAD_BYTES });
    return await uploadDocument(ctx, { kind: f.kind, filename: f.filename, key: f.key, bytes });
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(502, "BACKEND_UNREACHABLE", true); // the Blob store failed: no store text reaches the page
  } finally {
    await del(f.pathname).catch(() => undefined);
  }
}

export async function getDocument(ctx: Ctx, id: string): Promise<DocView> {
  return viewOf(await withReadGrant(ctx, () => ctx.client.get(ctx.session.t, id)), ctx.state);
}

export async function deleteDocument(ctx: Ctx, id: string): Promise<void> {
  await ctx.client.remove(ctx.session.t, id);
  if (ctx.state.d[id]) {
    delete ctx.state.d[id];
    await writeDocsState(ctx.state, ctx.secret);
  }
}

/** Idempotency keys carry the reading grant, so consenting again after a withdrawal makes fresh grants instead of replaying revoked ones. */
const gen = (state: DocsState) => (state.g ?? "none").slice(-8);
const soft = (e: unknown) => e instanceof AppError && (e.status < 500 || e.code === "READING_UNAVAILABLE") && e.code !== "UNAUTHENTICATED";

/**
 * One idempotent step of the pipeline for a scanned document: per-document reading grant, OCR job, then analysis run,
 * structuring grant and structuring run. Called on every poll; backend calls repeat only while a step is still running.
 * Reading and structuring need the person's go-ahead (ctx.state.g). `retry` re-attempts a step that failed or was unavailable.
 */
export async function advanceDocument(ctx: Ctx, id: string, retry: boolean): Promise<DocView> {
  const adultId = need(ctx.session);
  const { t: token, h: householdId } = ctx.session;
  const doc = await withReadGrant(ctx, () => ctx.client.get(token, id));
  const k = (p: string, docId: string) => `${p}-${docId}-${gen(ctx.state)}`;
  const e: DocState = ctx.state.d[id] ?? {};
  const save = async () => {
    ctx.state.d[id] = e;
    await writeDocsState(ctx.state, ctx.secret);
  };
  if (doc.status !== "accepted") return viewOf(doc, ctx.state);
  if (!ctx.state.g) throw new AppError(403, "CONSENT_REQUIRED");

  // Reading (OCR). A grant naming this exact document and the OCR recipient.
  if (e.r !== "done" && (retry || e.r === undefined || e.r === "running" || e.r === "none")) {
    try {
      e.s ??= await ctx.client.grant(token, {
        householdId, adultId, key: k("read", id), purpose: "document_processing", grantedToActor: "sarvam",
        scope: { resourceType: "document", resourceId: id, action: "derive", dataCategory: "insurance_document", recipient: "sarvam" },
      });
      const started = await ctx.client.startOcr(token, id, e.s, retry && (e.r === "failed" || e.r === "unavailable"));
      // Starting again returns the same job without asking the provider. A submitted job only moves when it is refreshed.
      let job: { status: string; errorCode: string | null } = started;
      if (started.id && (started.status === "submitted" || started.status === "processing")) {
        try {
          job = await ctx.client.refreshOcr(token, started.id, e.s);
        } catch (err) {
          if (!(err instanceof AppError && err.retryable)) throw err; // a busy provider keeps the step running
        }
      }
      if (job.status === "succeeded") e.r = "done";
      else if (job.status === "failed" || job.status === "cancelled") e.r = job.errorCode === "OCR_PROVIDER_DISABLED" ? "unavailable" : "failed";
      else e.r = "running";
    } catch (err) {
      if (err instanceof AppError && err.code === "READING_UNAVAILABLE") e.r = "unavailable";
      else {
        if (err instanceof AppError && err.code === "CONSENT_REQUIRED") ctx.state.g = undefined;
        await save();
        throw err;
      }
    }
    await save();
  }

  // Structuring. Needs a finished reading, an analysis run of the case and a grant naming this document for the model recipient.
  if (e.r === "done" && e.t !== "done" && (retry || e.t === undefined || e.t === "running" || e.t === "none")) {
    try {
      if (!e.w) {
        if (!ctx.state.c) throw new AppError(404, "NOT_FOUND");
        e.cg ??= await ctx.client.grant(token, {
          householdId, adultId, key: k("cover", id), purpose: "coverage_reconstruction",
          scope: { resourceType: "case", resourceId: ctx.state.c, action: "derive", dataCategory: "insurance_document" },
        });
        e.w = await ctx.client.startAnalysisRun(token, ctx.state.c, e.cg, k("run", id));
      }
      e.m ??= await ctx.client.grant(token, {
        householdId, adultId, key: k("derive", id), purpose: "document_processing", grantedToActor: "google-gemini",
        scope: { resourceType: "document", resourceId: id, action: "derive", dataCategory: "insurance_document", recipient: "google-gemini" },
      });
      const s = await ctx.client.startStructuring(token, id, { workflowRunId: e.w, consentGrantId: e.m, restart: retry && e.t === "failed" });
      if (s.status === "finished") e.t = s.evidenceOutcome === "failed" ? "failed" : "done";
      else if (s.status === "running") e.t = "running";
      else e.t = "failed";
    } catch (err) {
      // Structuring may be switched off or not set up for this case yet. The reading stays; only the last step is marked.
      if (!soft(err)) {
        await save();
        throw err;
      }
      e.t = "unavailable";
    }
    await save();
  }
  return viewOf(doc, ctx.state);
}

// ---- Route wrapper -----------------------------------------------------------------------------------------------------------

export async function withDocuments(req: Request, run: (ctx: Ctx) => Promise<unknown>, status = 200): Promise<Response> {
  try {
    assertSameOrigin(req);
    const { config } = runtime();
    const session = await readSession(config.cookieSecret);
    if (!session) throw new AppError(401, "UNAUTHENTICATED");
    const state = await readDocsState(config.cookieSecret, session);
    const out = await run({ client: createDocumentsClient({ baseUrl: config.apiUrl }), session, state, secret: config.cookieSecret });
    return json({ ok: true, ...(out && typeof out === "object" ? out : {}) }, status);
  } catch (e) {
    return failure(e);
  }
}

export const newRequestId = () => randomUUID();
