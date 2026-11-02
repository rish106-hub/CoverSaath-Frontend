import "server-only";
import { AppError, errorBody } from "./errors";
import type { FetchLike } from "./client";
import { guardedFetch } from "./resilience";

// Backend access for the person's own saved data (tool scenarios, household members). Server only: the session token never
// reaches the browser. Errors are coded and client-safe; backend messages and values are never copied into them.

export type DataErrorCode =
  | "UNAUTHENTICATED" | "INVALID_INPUT" | "REVISION_CONFLICT" | "PAYLOAD_TOO_LARGE" | "RATE_LIMITED" | "FORBIDDEN"
  | "MEMBER_PROTECTED" | "NOT_FOUND" | "BACKEND_UNREACHABLE" | "BACKEND_TIMEOUT" | "BACKEND_BAD_RESPONSE";

export class DataError extends Error {
  constructor(public status: number, public code: DataErrorCode, public retryable = false) {
    super(code);
    this.name = "DataError";
  }
}

const BY_CODE: Record<string, [number, DataErrorCode, boolean]> = {
  INVALID_REQUEST: [400, "INVALID_INPUT", false],
  PAYLOAD_TOO_LARGE: [413, "PAYLOAD_TOO_LARGE", false],
  REVISION_CONFLICT: [409, "REVISION_CONFLICT", true],
  USER_DATA_RATE_LIMITED: [429, "RATE_LIMITED", true],
  HOUSEHOLD_WRITE_FORBIDDEN: [403, "FORBIDDEN", false],
  MEMBER_PROTECTED: [403, "MEMBER_PROTECTED", false],
  MEMBER_NOT_FOUND: [404, "NOT_FOUND", false],
};

function backendCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { code?: unknown; error?: unknown };
  if (typeof b.code === "string") return b.code;
  if (b.error && typeof b.error === "object" && typeof (b.error as { code?: unknown }).code === "string") return (b.error as { code: string }).code;
  return null;
}

export function toDataError(status: number, body: unknown): DataError {
  const code = backendCode(body);
  const known = code ? BY_CODE[code] : undefined;
  if (known) return new DataError(known[0], known[1], known[2]);
  if (status === 401) return new DataError(401, "UNAUTHENTICATED");
  if (status === 409) return new DataError(409, "REVISION_CONFLICT", true);
  if (status === 413) return new DataError(413, "PAYLOAD_TOO_LARGE");
  if (status === 429) return new DataError(429, "RATE_LIMITED", true);
  if (status === 403) return new DataError(403, "FORBIDDEN");
  if (status === 404) return new DataError(404, "NOT_FOUND");
  if (status === 400 || status === 422) return new DataError(400, "INVALID_INPUT");
  return new DataError(502, "BACKEND_UNREACHABLE", true);
}

export type Send = (
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  o: { token: string; json?: unknown; ifMatch?: number },
) => Promise<unknown>;

/** One typed request to the backend. 5 s timeout, no redirects, coded errors. */
export function createSender(opts: { baseUrl: string; fetch?: FetchLike; timeoutMs?: number }): Send {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = opts.fetch ?? guardedFetch;
  const timeoutMs = opts.timeoutMs ?? 5000;
  return async (method, path, o) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${o.token}` };
    let body: string | undefined;
    if (o.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(o.json);
    }
    if (o.ifMatch !== undefined) headers["if-match"] = String(o.ifMatch);
    try {
      const res = await doFetch(`${base}${path}`, { method, headers, body, signal: controller.signal, cache: "no-store", redirect: "error" });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        if (res.ok) throw new DataError(502, "BACKEND_BAD_RESPONSE");
      }
      if (res.status >= 200 && res.status < 300) return parsed;
      throw toDataError(res.status, parsed);
    } catch (e) {
      if (e instanceof DataError || e instanceof AppError) throw e;
      if (controller.signal.aborted) throw new DataError(504, "BACKEND_TIMEOUT", true);
      throw new DataError(503, "BACKEND_UNREACHABLE", true);
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Response for a route handler: coded body, never a backend message. */
export function dataFailure(e: unknown): Response {
  const err: { status: number; code: string; retryable: boolean; retryAfter?: number } =
    e instanceof DataError ? e : e instanceof AppError ? { status: e.status, ...errorBody(e), retryAfter: e.retryAfter } : new DataError(500, "BACKEND_UNREACHABLE", true);
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (err.retryAfter !== undefined) headers["retry-after"] = String(err.retryAfter);
  return Response.json({ ok: false, code: err.code, retryable: err.retryable }, { status: err.status, headers });
}
