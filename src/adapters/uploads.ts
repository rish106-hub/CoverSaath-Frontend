import { AdapterError } from "./types";
import { upload as blobUpload } from "@vercel/blob/client";
import { MAX_LARGE_UPLOAD_BYTES, MAX_UPLOAD_BYTES, blobInfoOut, consentOut, deleteOut, listOut, oneOut, type DocView, type DocumentKind, type PolicyType } from "./documents-contract";
import { fetchWithRetry } from "@/lib/retry-fetch";

// Browser client for the same-origin documents BFF (/api/app/documents/*). It never sees the backend token or the backend.

export type UploadAdapter = {
  list(): Promise<{ consent: boolean; documents: DocView[]; largeUpload: boolean; policyType: PolicyType | null }>;
  /** `requestId` is reused when the call is repeated, so a retry cannot create a second grant. */
  grantConsent(requestId: string): Promise<void>;
  revokeConsent(): Promise<void>;
  /** `key` is reused when the same file is retried, so a retry cannot store the file twice. */
  upload(file: File, kind: DocumentKind, key: string, policyType: PolicyType): Promise<DocView>;
  /** Moves a scanned document one step on (reading, then cover details). */
  advance(id: string, retry?: boolean): Promise<DocView>;
  remove(id: string): Promise<void>;
};

/** Checks the browser can do before sending. The server checks again. Returns an error code or null. */
export function precheck(file: { name: string; type: string; size: number }, max: number = MAX_UPLOAD_BYTES): "FILE_TYPE_INVALID" | "FILE_TOO_LARGE" | "FILE_EMPTY" | null {
  const pdf = file.type === "application/pdf" || (file.type === "" && /\.pdf$/i.test(file.name));
  if (!pdf) return "FILE_TYPE_INVALID";
  if (file.size === 0) return "FILE_EMPTY";
  if (file.size > max) return "FILE_TOO_LARGE";
  return null;
}

const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "-");
export const makeRequestKey = (): string => `k-${newKey()}`.slice(0, 100);

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchWithRetry(path, { ...init, cache: "no-store", headers: { "x-knowvia-app": "1", ...init.headers } });
  } catch {
    throw new AdapterError("BACKEND_UNREACHABLE", true);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const b = (body ?? {}) as { code?: unknown; retryable?: unknown };
    throw new AdapterError(typeof b.code === "string" ? b.code : "BACKEND_UNREACHABLE", b.retryable === true || res.status >= 500);
  }
  return body;
}

const json = { "content-type": "application/json" };
const parse = <T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, v: unknown): T => {
  const r = schema.safeParse(v);
  if (!r.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return r.data;
};
const id = (v: string) => encodeURIComponent(v);

/**
 * Over 4 MB: ask the server for the household's folder (this also tells us whether a Blob store exists), send the file straight to
 * Blob, then ask the server to take it from there. A new blob name per attempt; `key` stays the same, so a retry cannot store twice.
 */
async function uploadLarge(file: File, kind: DocumentKind, key: string, policyType: PolicyType): Promise<DocView> {
  let info: { prefix: string };
  try {
    info = parse(blobInfoOut, await call("/api/app/documents/blob-token"));
  } catch (e) {
    // No store set up here (or the server refused): the file is simply over the limit this server takes.
    if (e instanceof AdapterError && e.code === "UPLOAD_UNAVAILABLE") throw new AdapterError("FILE_TOO_LARGE");
    throw e;
  }
  const pathname = `${info.prefix}${makeRequestKey()}.pdf`;
  try {
    await blobUpload(pathname, file, {
      access: "private",
      handleUploadUrl: "/api/app/documents/blob-token",
      contentType: "application/pdf",
      headers: { "x-knowvia-app": "1" },
      multipart: file.size > 8 * 1024 * 1024,
    });
  } catch {
    throw new AdapterError("BACKEND_UNREACHABLE", true);
  }
  const r = await call("/api/app/documents/from-blob", { method: "POST", headers: json, body: JSON.stringify({ pathname, filename: file.name, kind, policyType, key }) });
  return parse(oneOut, r).document;
}

export const backendUploads: UploadAdapter = {
  async list() {
    const r = parse(listOut, await call("/api/app/documents"));
    return { consent: r.consent, documents: r.documents, largeUpload: r.largeUpload === true, policyType: r.policyType ?? null };
  },
  async grantConsent(requestId) {
    parse(consentOut, await call("/api/app/documents/consent", { method: "POST", headers: json, body: JSON.stringify({ accept: true, requestId }) }));
  },
  async revokeConsent() {
    parse(consentOut, await call("/api/app/documents/consent", { method: "DELETE" }));
  },
  async upload(file, kind, key, policyType) {
    const pre = precheck(file, MAX_LARGE_UPLOAD_BYTES);
    if (pre) throw new AdapterError(pre);
    if (file.size > MAX_UPLOAD_BYTES) return uploadLarge(file, kind, key, policyType);
    const r = await call("/api/app/documents", {
      method: "POST",
      headers: { "content-type": "application/pdf", "x-filename": encodeURIComponent(file.name), "x-document-kind": kind, "x-policy-type": policyType, "idempotency-key": key },
      body: file,
    });
    return parse(oneOut, r).document;
  },
  async advance(docId, retry = false) {
    const r = await call(`/api/app/documents/${id(docId)}/advance`, { method: "POST", headers: json, body: JSON.stringify(retry ? { retry: true } : {}) });
    return parse(oneOut, r).document;
  },
  async remove(docId) {
    parse(deleteOut, await call(`/api/app/documents/${id(docId)}`, { method: "DELETE" }));
  },
};
