import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { del, get, list as listBlobs } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { z } from "zod";
import { AppError } from "./errors";
import { assertSameOrigin } from "./guard";
import { runtime, readSession, clearSession, json, failure } from "./index";
import { openValue, sealValue, type SessionPayload } from "./session";
import type { FetchLike } from "./client";
import { guardedFetch } from "./resilience";
import { BLOB_NAME, BLOB_TOKEN_TTL_MS, DOCUMENT_KINDS, MAX_LARGE_UPLOAD_BYTES, MAX_UPLOAD_BYTES, deriveView, policyType, whyFromBackendCode, type DocView, type PolicyType, type ProgressCode, type StructuringWhy } from "@/adapters/documents-contract";

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
  // The case is not in the state analysis needs. Not retryable: repeating the same call cannot fix it (it used to loop every 3 s).
  CASE_NOT_READY_FOR_ANALYSIS: [409, "NOT_READY", false],
  STALE_REVISION: [409, "NOT_READY", true],
  // An earlier structuring attempt failed or was interrupted. The backend wants an explicit restart (a new paid attempt).
  STRUCTURING_RESTART_REQUIRED: [409, "STRUCTURING_RESTART", false],
  INVALID_CASE_TRANSITION: [409, "NOT_READY", false],
  // Policy profile (backend ADR 0024) and evidence answers.
  POLICY_PROFILE_NOT_FOUND: [404, "POLICY_PROFILE_NOT_FOUND", false],
  POLICY_PROFILE_VERSION_CONFLICT: [409, "POLICY_PROFILE_VERSION_CONFLICT", false],
  POLICY_PROFILE_CONFLICTING_FACTS: [409, "POLICY_PROFILE_CONFLICTING_FACTS", false],
  POLICY_PROFILE_NOT_READY: [409, "POLICY_PROFILE_NOT_READY", true],
  POLICY_PROFILE_INVALID_UIN: [422, "POLICY_PROFILE_INVALID_UIN", false],
  POLICY_PROFILE_INVALID: [422, "POLICY_PROFILE_INVALID", false],
  POLICY_FACTS_DISABLED: [503, "POLICY_FACTS_DISABLED", false],
  EVIDENCE_DISABLED: [503, "EVIDENCE_DISABLED", false],
  POLICY_EVIDENCE_UNAVAILABLE: [409, "POLICY_EVIDENCE_UNAVAILABLE", false],
  IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_CONFLICT", false],
  // Holdings and facts (backend ADR 0032). Only the code is read; the backend message never leaves.
  HOLDINGS_DISABLED: [503, "HOLDINGS_DISABLED", false],
  HOLDING_NOT_FOUND: [404, "NOT_FOUND", false],
  HOLDING_NOT_READY: [409, "NOT_READY", true],
  HOLDING_TRANSITION_INVALID: [409, "NOT_READY", false],
  HOLDING_DOCUMENT_NOT_READABLE: [409, "NOT_READY", true],
  HOLDING_REGISTRY_UNAVAILABLE: [503, "HOLDING_REGISTRY_UNAVAILABLE", true],
  HOLDING_PRODUCT_INVALID: [400, "INVALID_INPUT", false],
  HOLDING_PRODUCT_NOT_FOUND: [404, "NOT_FOUND", false],
  HOLDING_PRODUCT_UNSUPPORTED: [422, "HOLDING_PRODUCT_UNSUPPORTED", false],
  MEMORY_CONFLICT_NOT_FOUND: [404, "NOT_FOUND", false],
  MEMORY_CONFLICT_ALREADY_RESOLVED: [409, "CONFLICT_ALREADY_RESOLVED", false],
  MEMORY_CONFLICT_CHOICE_INVALID: [400, "INVALID_INPUT", false],
  MEMORY_CONFLICT_STALE: [409, "CONFLICT_STALE", true],
  // Declarations, premiums and dues (CoverSaath #104). Only the code is read.
  DECLARATION_NOT_FOUND: [404, "NOT_FOUND", false],
  PREMIUM_NOT_FOUND: [404, "NOT_FOUND", false],
  REVISION_CONFLICT: [409, "REVISION_CONFLICT", false],
  // Chat threads and turns (backend ADR 0031). Only the code is read.
  MEMORY_DISABLED: [503, "MEMORY_DISABLED", false],
  CHAT_THREAD_NOT_FOUND: [404, "NOT_FOUND", false],
  CHAT_REQUEST_INVALID: [400, "INVALID_INPUT", false],
};

/** The prior attempt's failure code on a restart-required answer. Only a pattern-valid code is read; any message is ignored. */
function priorErrorCode(body: unknown): string | null {
  const c = (body as { error?: { priorErrorCode?: unknown } } | null)?.error?.priorErrorCode;
  return typeof c === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(c) ? c : null;
}

function backendCode(body: unknown): string | null {
  const c = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof c === "string" ? c : null;
}

/** A failed backend answer becomes a coded, client-safe error. Only the code and status are read; the message never leaves. */
export function mapDocFailure(status: number, body: unknown, strict401 = false): AppError {
  const known = BY_CODE[backendCode(body) ?? ""];
  if (known) {
    const err = new AppError(known[0], known[1], known[2]);
    if (known[1] === "STRUCTURING_RESTART") err.reason = whyFromBackendCode(priorErrorCode(body));
    return err;
  }
  if (status === 401 && strict401) {
    // Only the backend's own coded rejection of the bearer token ends the session. An uncoded 401 (a proxy, a gateway) says nothing
    // about the session: it is a retryable failure and the person stays signed in.
    if (backendCode(body) === "AUTHENTICATION_REQUIRED") {
      const ended = new AppError(401, "UNAUTHENTICATED");
      ended.clearSession = true;
      return ended;
    }
    return new AppError(502, "BACKEND_UNREACHABLE", true);
  }
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
const caseDto = z.object({ id: z.string().min(1), status: z.string().nullish(), revision: z.string().nullish() }).loose();
const docDto = z.object({
  id: z.string(), documentKind: z.string(), byteSize: z.number(), status: z.string(), uploadedAt: z.string().nullish(),
}).loose();
type BackendDocDto = z.infer<typeof docDto>;

type GrantScope = { resourceType: string; resourceId: string | null; action: string; dataCategory: string; recipient?: string };

export function createDocumentsClient(opts: { baseUrl: string; fetch?: FetchLike; strict401?: boolean }) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = opts.fetch ?? guardedFetch;

  async function send(method: "GET" | "POST" | "PUT" | "DELETE", path: string, token: string, o: { json?: unknown; headers?: Record<string, string>; bytes?: Uint8Array; timeoutMs?: number } = {}): Promise<Out> {
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
      if (res.status < 200 || res.status >= 300) throw mapDocFailure(res.status, parsed, opts.strict401 === true);
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
    /** For the evidence routes (src/server/backend/evidence.ts): same guarded send, same coded failures. */
    send,
    async createCase(token: string, householdId: string, policyType: PolicyType): Promise<{ id: string; status: string | null; revision: string | null }> {
      const r = await send("POST", "/api/v1/cases", token, { json: { householdId, triggerType: "user_requested_review", policyType } });
      const c = parse(caseDto, r.body);
      return { id: c.id, status: c.status ?? null, revision: c.revision ?? null };
    },
    /** Moves the case one step. `expectedRevision` is the revision the caller last saw; a stale one is refused by the backend. */
    async transitionCase(token: string, caseId: string, toStatus: string, expectedRevision: string): Promise<{ status: string | null; revision: string | null }> {
      const r = await send("POST", `/api/v1/cases/${encodeURIComponent(caseId)}/transitions`, token, { json: { toStatus, expectedRevision } });
      const c = parse(caseDto, r.body);
      return { status: c.status ?? null, revision: c.revision ?? null };
    },
    /** Only for a case this app made before it kept the revision. Needs the backend's case-summary read consent. */
    async readCase(token: string, caseId: string): Promise<{ status: string | null; revision: string | null }> {
      const c = parse(caseDto, (await send("GET", `/api/v1/cases/${encodeURIComponent(caseId)}`, token)).body);
      return { status: c.status ?? null, revision: c.revision ?? null };
    },
    /** Replay-safe: the same key returns the same grant. */
    async grant(token: string, g: { householdId: string; adultId: string; key: string; purpose: string; grantedToActor?: string; scope: GrantScope; scopes?: GrantScope[] }): Promise<string> {
      const r = await send("POST", "/api/v1/consents", token, {
        headers: idem(g.key),
        json: { householdId: g.householdId, subjectAdultId: g.adultId, purpose: g.purpose, ...(g.grantedToActor ? { grantedToActor: g.grantedToActor } : {}), evidenceMethod: "typed", scopes: g.scopes ?? [g.scope] },
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

type DocState = { s?: string; m?: string; cg?: string; w?: string; r?: ProgressCode; t?: ProgressCode; f?: StructuringWhy; fa?: number };
/** c case, pt the policy type the case was started with, cs/rv case status and revision as last seen (revision guards the next transition), g reading grant, v case read grant (lets the owner read the case's source list), d per-document ids and progress, x grants whose revoke has not gone through yet, q grants for questions about documents (revoked with the rest). */
export type DocsState = { h: string; exp: number; c?: string; pt?: PolicyType; cs?: string; rv?: string; g?: string; v?: string; x?: string[]; q?: string[]; d: Record<string, DocState> };

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

export const need = (s: SessionPayload): string => {
  if (!s.a) throw new AppError(401, "UNAUTHENTICATED"); // session made before documents existed: sign in again
  return s.a;
};

const viewOf = (doc: BackendDocDto, state: DocsState): DocView => {
  const e = state.d[doc.id];
  return deriveView(doc, e?.r ?? "none", e?.t ?? "none", Date.now(), { why: e?.f ?? null, failedAt: e?.fa ?? null });
};

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
  ids.push(...(ctx.state.q ?? []));
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
  ctx.state.q = undefined;
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
export async function withReadGrant<T>(ctx: Ctx, run: () => Promise<T>): Promise<T> {
  await ensureReadGrant(ctx);
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof AppError && e.code === "CONSENT_REQUIRED" && ctx.state.g && ctx.state.c)) throw e;
    await ensureReadGrant(ctx, true);
    return await run();
  }
}

export async function listDocuments(ctx: Ctx): Promise<{ consent: boolean; documents: DocView[]; largeUpload: boolean; policyType: PolicyType | null }> {
  const consent = Boolean(ctx.state.g);
  const largeUpload = largeUploadEnabled();
  const kept = ctx.state.c ? ctx.state.pt ?? null : null;
  if (!ctx.state.c) return { consent, documents: [], largeUpload, policyType: null };
  const c = ctx.state.c;
  const docs = await withReadGrant(ctx, () => ctx.client.list(ctx.session.t, c));
  return { consent, documents: docs.filter((d) => d.status !== "deleted").map((d) => viewOf(d, ctx.state)), largeUpload, policyType: kept };
}

/** `policyType` is required. It is sent when the case is created; a case that already exists keeps the type it was started with. */
export async function uploadDocument(ctx: Ctx, f: { kind: string; policyType: string; filename: string; key: string; bytes: Uint8Array }): Promise<DocView> {
  need(ctx.session);
  if (!ctx.state.g) throw new AppError(403, "CONSENT_REQUIRED");
  if (!(DOCUMENT_KINDS as readonly string[]).includes(f.kind) || !keyPattern.test(f.key)) throw new AppError(400, "INVALID_INPUT");
  const type = policyType.safeParse(f.policyType);
  if (!type.success) throw new AppError(400, "INVALID_INPUT");
  if (!ctx.state.c) {
    const made = await ctx.client.createCase(ctx.session.t, ctx.session.h, type.data);
    ctx.state.c = made.id;
    ctx.state.pt = type.data;
    ctx.state.cs = made.status ?? undefined;
    ctx.state.rv = made.revision ?? undefined;
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
  if (ctx.session.demo) throw new AppError(403, "FORBIDDEN");
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
export async function uploadFromBlob(ctx: Ctx, f: { pathname: string; kind: string; policyType: string; filename: string; key: string }): Promise<DocView> {
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
    return await uploadDocument(ctx, { kind: f.kind, policyType: f.policyType, filename: f.filename, key: f.key, bytes });
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
export const gen = (state: DocsState) => (state.g ?? "none").slice(-8);
// A retryable "not ready" (another request moved the case) is tried again on the next poll, not turned into a final state.
const soft = (e: unknown) => e instanceof AppError && (e.status < 500 || e.code === "READING_UNAVAILABLE") && e.code !== "UNAUTHENTICATED" && !(e.code === "NOT_READY" && e.retryable);

/**
 * The backend only queues an analysis run for a case in `processing`; a new case starts as `created` and nothing else moves it.
 * Walks created -> collecting -> processing, carrying the revision each answer returns. Repeat calls do nothing once there.
 * A case this app made before it kept the revision is read once; if that read is refused, the coded error reaches the page.
 */
async function ensureCaseProcessing(ctx: Ctx, caseId: string): Promise<void> {
  if (ctx.state.cs === "processing") return;
  const token = ctx.session.t;
  if (!ctx.state.rv || !ctx.state.cs) {
    const seen = await ctx.client.readCase(token, caseId);
    ctx.state.cs = seen.status ?? undefined;
    ctx.state.rv = seen.revision ?? undefined;
    if (!ctx.state.rv || !ctx.state.cs) throw new AppError(502, "BACKEND_BAD_RESPONSE");
  }
  try {
    while (ctx.state.cs !== "processing") {
      const to = ctx.state.cs === "created" ? "collecting" : "processing";
      const next = await ctx.client.transitionCase(token, caseId, to, ctx.state.rv as string);
      if (!next.revision || !next.status) throw new AppError(502, "BACKEND_BAD_RESPONSE");
      ctx.state.cs = next.status;
      ctx.state.rv = next.revision;
      await writeDocsState(ctx.state, ctx.secret);
    }
  } catch (e) {
    // A stale revision means another request moved the case. Forget ours so the next try reads it fresh.
    if (e instanceof AppError && e.code === "NOT_READY") {
      ctx.state.cs = undefined;
      ctx.state.rv = undefined;
      await writeDocsState(ctx.state, ctx.secret);
    }
    throw e;
  }
}

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
        await ensureCaseProcessing(ctx, ctx.state.c);
        e.w = await ctx.client.startAnalysisRun(token, ctx.state.c, e.cg, k("run", id));
      }
      e.m ??= await ctx.client.grant(token, {
        householdId, adultId, key: k("derive", id), purpose: "document_processing", grantedToActor: "google-gemini",
        scope: { resourceType: "document", resourceId: id, action: "derive", dataCategory: "insurance_document", recipient: "google-gemini" },
      });
      const s = await ctx.client.startStructuring(token, id, { workflowRunId: e.w, consentGrantId: e.m, restart: retry && e.t === "failed" });
      e.f = undefined;
      e.fa = undefined;
      if (s.status === "finished") e.t = s.evidenceOutcome === "failed" ? "failed" : "done";
      else if (s.status === "running") e.t = "running";
      else e.t = "failed";
    } catch (err) {
      // The earlier attempt failed: show "try again" (which sends restart) instead of polling a refusal forever.
      if (err instanceof AppError && err.code === "STRUCTURING_RESTART") {
        e.t = "failed";
        e.f = err.reason === "unavailable" || err.reason === "quota" || err.reason === "auth" || err.reason === "budget" ? err.reason : "other";
        e.fa = Date.now();
        await save();
        return viewOf(doc, ctx.state);
      }
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

export async function withDocuments(req: Request, run: (ctx: Ctx) => Promise<unknown>, status = 200, opts: { strict401?: boolean } = {}): Promise<Response> {
  try {
    assertSameOrigin(req);
    const { config } = runtime();
    const session = await readSession(config.cookieSecret);
    if (!session) throw new AppError(401, "UNAUTHENTICATED");
    const state = await readDocsState(config.cookieSecret, session);
    const out = await run({ client: createDocumentsClient({ baseUrl: config.apiUrl, strict401: opts.strict401 }), session, state, secret: config.cookieSecret });
    return json({ ok: true, ...(out && typeof out === "object" ? out : {}) }, status);
  } catch (e) {
    // The backend itself said the token is finished: end the session here too, so the page sends the person to sign in.
    if (e instanceof AppError && e.clearSession) await clearSession().catch(() => undefined);
    return failure(e);
  }
}

export const newRequestId = () => randomUUID();
