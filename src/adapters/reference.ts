import { AdapterError, type ReferenceAdapter } from "./types";
import { referenceProductsOut, referenceQuery, referenceSearch } from "./reference-contract";

// Browser client for the same-origin BFF route /api/app/reference/products. The browser never sees the backend token.

export const backendReference: ReferenceAdapter = {
  async products(query) {
    const q = referenceQuery.safeParse(query);
    if (!q.success) throw new AdapterError("INVALID_INPUT");
    let res: Response;
    try {
      res = await fetch(`/api/app/reference/products?${referenceSearch(q.data)}`, { method: "GET", cache: "no-store", headers: { "x-knowvia-app": "1" } });
    } catch {
      throw new AdapterError("BACKEND_UNREACHABLE", true);
    }
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const b = body as { code?: unknown; retryable?: unknown };
      throw new AdapterError(typeof b.code === "string" ? b.code : "BACKEND_UNREACHABLE", b.retryable === true);
    }
    const p = referenceProductsOut.safeParse(body);
    if (!p.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
    const { products, ambiguous, fetchedAt } = p.data;
    return { products, ambiguous, fetchedAt };
  },
};
