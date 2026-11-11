import { AdapterError, type EvidenceAdapter } from "./types";
import { evidenceOut, type PassThrough } from "./evidence-contract";

// Browser client for the same-origin evidence BFF (/api/app/...). It never sees the backend token or the backend.

const enc = encodeURIComponent;

async function call(path: string, init: { method?: "GET" | "POST"; json?: unknown; key?: string } = {}): Promise<PassThrough> {
  const headers: Record<string, string> = { "x-knowvia-app": "1" };
  if (init.json !== undefined) headers["content-type"] = "application/json";
  if (init.key) headers["idempotency-key"] = init.key;
  let res: Response;
  try {
    res = await fetch(path, { method: init.method ?? "GET", cache: "no-store", headers, body: init.json === undefined ? undefined : JSON.stringify(init.json) });
  } catch {
    throw new AdapterError("BACKEND_UNREACHABLE", true);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const b = (body ?? {}) as { code?: unknown; retryable?: unknown };
    throw new AdapterError(typeof b.code === "string" ? b.code : res.status === 401 ? "UNAUTHENTICATED" : "BACKEND_UNREACHABLE", b.retryable === true || res.status >= 500);
  }
  const parsed = evidenceOut.safeParse(body);
  const data = parsed.success ? parsed.data.data : undefined;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return data as PassThrough;
}

export const backendEvidence: EvidenceAdapter = {
  policyProfile: (documentId) => call(`/api/app/documents/${enc(documentId)}/policy-profile`),
  confirmPolicyProfile: (documentId, statement, key) => call(`/api/app/documents/${enc(documentId)}/policy-profile/confirm`, { method: "POST", json: statement, key }),
  ask: (caseId, input, key) => call(`/api/app/cases/${enc(caseId)}/questions`, { method: "POST", json: input, key }),
  answer: (caseId, answerId) => call(`/api/app/cases/${enc(caseId)}/answers/${enc(answerId)}`),
  handoff: (caseId, query) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    return call(`/api/app/cases/${enc(caseId)}/decision-catalogue?${params}`);
  },
  review: (caseId, input, key) => call(`/api/app/cases/${enc(caseId)}/catalogue-reviews`, { method: "POST", json: input, key }),
  designateConfirmer: (adultUserId) => call("/api/app/catalogue-confirmers", { method: "POST", json: { adultUserId } }),
  preview: (body) => call("/api/app/coverage-preview", { method: "POST", json: body }),
  sourcePack: (caseId) => call(`/api/app/cases/${enc(caseId)}/source-pack`),
  deletionInventory: (caseId) => call(`/api/app/cases/${enc(caseId)}/deletion-inventory`),
  integrations: () => call("/api/app/integrations"),
};
