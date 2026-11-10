import "server-only";
import { AppError } from "./errors";
import { guardedFetch } from "./resilience";
import { mapFailure } from "./user-data";
import { referenceProductsIn, referenceQuery, referenceSearch, type ReferenceProducts, type ReferenceQuery } from "@/adapters/reference-contract";
import type { FetchLike } from "./client";

// BFF client for the backend reference route (GET /api/v1/reference/products). Public reference context only: no household id is
// sent. The backend token stays server-side. Backend text is never forwarded; "not configured" becomes REFERENCE_UNAVAILABLE.

export const REFERENCE_TIMEOUT_MS = 5000;
const UNAVAILABLE = new Set(["REFERENCE_DATA_NOT_CONFIGURED", "REFERENCE_DATA_UNAVAILABLE", "REFERENCE_DATA_DISABLED"]);
const code = (b: unknown): string | null => {
  const c = (b as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof c === "string" ? c : null;
};

/** Exactly one of q, uin, insurerId, once. Anything else is INVALID_INPUT and nothing is sent. */
export function readReferenceQuery(req: Request): ReferenceQuery {
  const params = new URL(req.url).searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of params) {
    if (Object.hasOwn(raw, k)) throw new AppError(400, "INVALID_INPUT");
    raw[k] = v;
  }
  const r = referenceQuery.safeParse(raw);
  if (!r.success) throw new AppError(400, "INVALID_INPUT");
  return r.data;
}

export function createReferenceClient(opts: { baseUrl: string; fetch?: FetchLike; timeoutMs?: number }) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = opts.fetch ?? guardedFetch;
  const timeoutMs = opts.timeoutMs ?? REFERENCE_TIMEOUT_MS;
  return {
    async products(token: string, query: ReferenceQuery): Promise<ReferenceProducts> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(`${base}/api/v1/reference/products?${referenceSearch(query)}`, {
          method: "GET",
          headers: { accept: "application/json", authorization: `Bearer ${token}` },
          signal: controller.signal, cache: "no-store", redirect: "error",
        });
        const text = await res.text();
        let parsed: unknown = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { if (res.ok) throw new AppError(502, "BACKEND_BAD_RESPONSE"); }
        if (res.status < 200 || res.status >= 300) {
          if (res.status === 503 && UNAVAILABLE.has(code(parsed) ?? "")) throw new AppError(503, "REFERENCE_UNAVAILABLE");
          throw mapFailure(res.status, parsed);
        }
        const r = referenceProductsIn.safeParse(parsed);
        if (!r.success) throw new AppError(502, "BACKEND_BAD_RESPONSE");
        const { products, ambiguous, fetchedAt } = r.data;
        return { products, ambiguous, fetchedAt };
      } catch (e) {
        if (e instanceof AppError) throw e;
        if (controller.signal.aborted) throw new AppError(504, "BACKEND_TIMEOUT", true);
        throw new AppError(503, "BACKEND_UNREACHABLE", true);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
