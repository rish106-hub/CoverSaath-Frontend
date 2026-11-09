import { AdapterError } from "./types";
import { MAX_UPLOAD_BYTES, consentOut, deleteOut, listOut, oneOut, type DocView, type DocumentKind } from "./documents-contract";
import { fetchWithRetry } from "@/lib/retry-fetch";

// Browser client for the same-origin documents BFF (/api/app/documents/*). It never sees the backend token or the backend.

export type UploadAdapter = {
  list(): Promise<{ consent: boolean; documents: DocView[] }>;
  /** `requestId` is reused when the call is repeated, so a retry cannot create a second grant. */
  grantConsent(requestId: string): Promise<void>;
  revokeConsent(): Promise<void>;
  /** `key` is reused when the same file is retried, so a retry cannot store the file twice. */
  upload(file: File, kind: DocumentKind, key: string): Promise<DocView>;
  /** Moves a scanned document one step on (reading, then cover details). */
  advance(id: string, retry?: boolean): Promise<DocView>;
  remove(id: string): Promise<void>;
};

/** Checks the browser can do before sending. The server checks again. Returns an error code or null. */
export function precheck(file: { name: string; type: string; size: number }): "FILE_TYPE_INVALID" | "FILE_TOO_LARGE" | "FILE_EMPTY" | null {
  const pdf = file.type === "application/pdf" || (file.type === "" && /\.pdf$/i.test(file.name));
  if (!pdf) return "FILE_TYPE_INVALID";
  if (file.size === 0) return "FILE_EMPTY";
  if (file.size > MAX_UPLOAD_BYTES) return "FILE_TOO_LARGE";
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

export const backendUploads: UploadAdapter = {
  async list() {
    const r = parse(listOut, await call("/api/app/documents"));
    return { consent: r.consent, documents: r.documents };
  },
  async grantConsent(requestId) {
    parse(consentOut, await call("/api/app/documents/consent", { method: "POST", headers: json, body: JSON.stringify({ accept: true, requestId }) }));
  },
  async revokeConsent() {
    parse(consentOut, await call("/api/app/documents/consent", { method: "DELETE" }));
  },
  async upload(file, kind, key) {
    const pre = precheck(file);
    if (pre) throw new AdapterError(pre);
    const r = await call("/api/app/documents", {
      method: "POST",
      headers: { "content-type": "application/pdf", "x-filename": encodeURIComponent(file.name), "x-document-kind": kind, "idempotency-key": key },
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
