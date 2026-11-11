import { AdapterError, type CoversAdapter } from "./types";
import { MAX_UPLOAD_BYTES } from "./documents-contract";
import { backendUploads, precheck } from "./uploads";
import { candidatesIn, confirmedIn, conflictsIn, coverOut, declarationView, factsIn, holdingsIn, premiumView, resolvedIn } from "./covers-contract";
import { hospitalsIn } from "./chat-contract";
import { z } from "zod";

// Browser client for the same-origin cover BFF (/api/app/covers). It never sees the backend token or the backend: every call goes to
// this app's own routes. Uploads stay under the 4 MB the BFF takes (the large-file handoff is not used here).

const enc = encodeURIComponent;
const POLL_MS = 2000;
const POLL_TRIES = 8;

async function call(path: string, init: { method?: "GET" | "POST"; json?: unknown; key?: string } = {}): Promise<unknown> {
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
  const outer = coverOut.safeParse(body);
  if (!outer.success || outer.data.data === undefined) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return outer.data.data;
}

function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return r.data;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const backendCovers: CoversAdapter = {
  async upload(file, key) {
    const pre = precheck(file, MAX_UPLOAD_BYTES);
    if (pre) throw new AdapterError(pre);
    // Policy type: a health policy. The case keeps the type it was first started with.
    let doc = await backendUploads.upload(file, "policy_wording", key, "personal_health");
    for (let i = 0; i < POLL_TRIES && doc.busy; i += 1) {
      await wait(POLL_MS);
      doc = await backendUploads.advance(doc.id);
    }
    // The backend makes the holding; the page waits a little for it, then lets the person check again.
    for (let i = 0; i < POLL_TRIES; i += 1) {
      const found = (await this.holdings()).find((h) => h.documentId === doc.id);
      if (found) return { documentId: doc.id, holdingId: found.id };
      await wait(POLL_MS);
    }
    return { documentId: doc.id, holdingId: null };
  },
  async holdings() {
    return parse(holdingsIn, await call("/api/app/covers/holdings")).holdings;
  },
  async candidates(holdingId) {
    return parse(candidatesIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/candidates`));
  },
  async confirmProduct(holdingId, statement, key) {
    return parse(confirmedIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/confirm`, { method: "POST", json: statement, key }));
  },
  async facts(holdingId) {
    return parse(factsIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/facts`));
  },
  async conflicts(holdingId) {
    return parse(conflictsIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/conflicts`));
  },
  async resolveConflict(holdingId, conflictId, choice) {
    return parse(resolvedIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/conflicts/${enc(conflictId)}/resolve`, { method: "POST", json: choice }));
  },
  async declarations() {
    return parse(z.object({ declarations: z.array(declarationView) }), await call("/api/app/covers/declarations")).declarations;
  },
  async addDeclaration(input) {
    return parse(declarationView, await call("/api/app/covers/declarations", { method: "POST", json: input }));
  },
  async premiums() {
    return parse(z.object({ premiums: z.array(premiumView) }), await call("/api/app/covers/premiums")).premiums;
  },
  async addPremium(input) {
    return parse(premiumView, await call("/api/app/covers/premiums", { method: "POST", json: input }));
  },
  async hospitals(holdingId, pincode) {
    return parse(hospitalsIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/hospitals?pincode=${enc(pincode)}`)).hospitals;
  },
};
