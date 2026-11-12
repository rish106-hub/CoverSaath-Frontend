import type { z } from "zod";
import { AdapterError, type CoversAdapter } from "./types";
import { MAX_UPLOAD_BYTES } from "./documents-contract";
import { backendUploads, precheck } from "./uploads";
import { candidatesIn, confirmedIn, conflictsIn, coverOut, declarationView, deletedOut, declarationsIn, dueView, duesIn, factsIn, holdingDocumentsIn, holdingsIn, linkedIn, premiumsIn, premiumView, resolvedIn } from "./covers-contract";
import { hospitalsIn } from "./chat-contract";

// Browser client for the same-origin cover BFF (/api/app/covers). It never sees the backend token or the backend: every call goes to
// this app's own routes. Uploads stay under the 4 MB the BFF takes (the large-file handoff is not used here).

const enc = encodeURIComponent;
const POLL_MS = 2000;
const POLL_TRIES = 8;

async function call(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; json?: unknown; key?: string } = {}): Promise<unknown> {
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
  async uploadDocument(file, key, kind, policyType) {
    const pre = precheck(file, MAX_UPLOAD_BYTES);
    if (pre) throw new AdapterError(pre);
    let doc = await backendUploads.upload(file, kind, key, policyType);
    for (let i = 0; i < POLL_TRIES && doc.busy; i += 1) {
      await wait(POLL_MS);
      doc = await backendUploads.advance(doc.id);
    }
    return { documentId: doc.id };
  },
  async holdingFor(documentId) {
    // The backend makes the holding; the page waits a little for it, then lets the person check again.
    for (let i = 0; i < POLL_TRIES; i += 1) {
      const found = (await this.holdings()).find((h) => h.documentId === documentId);
      if (found) return found.id;
      await wait(POLL_MS);
    }
    return null;
  },
  async upload(file, key, opts) {
    const { documentId } = await this.uploadDocument(file, key, opts.kind, opts.policyType);
    return { documentId, holdingId: await this.holdingFor(documentId) };
  },
  async holdingDocuments(holdingId) {
    return parse(holdingDocumentsIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/documents`));
  },
  async linkDocument(holdingId, input) {
    return parse(linkedIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/documents`, { method: "POST", json: input }));
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
  async declarations(memberId) {
    return parse(declarationsIn, await call(`/api/app/covers/declarations${memberId ? `?memberId=${enc(memberId)}` : ""}`)).declarations;
  },
  async addDeclaration(input) {
    return parse(declarationView, await call("/api/app/covers/declarations", { method: "POST", json: input }));
  },
  async updateDeclaration(declarationId, input) {
    return parse(declarationView, await call(`/api/app/covers/declarations/${enc(declarationId)}`, { method: "PUT", json: input }));
  },
  async deleteDeclaration(declarationId) {
    parse(deletedOut, await call(`/api/app/covers/declarations/${enc(declarationId)}`, { method: "DELETE" }));
  },
  async premiums(holdingId) {
    return parse(premiumsIn, await call(`/api/app/covers/premiums${holdingId ? `?holdingId=${enc(holdingId)}` : ""}`)).premiums;
  },
  async addPremium(input) {
    return parse(premiumView, await call("/api/app/covers/premiums", { method: "POST", json: input }));
  },
  async deletePremium(paymentId) {
    parse(deletedOut, await call(`/api/app/covers/premiums/${enc(paymentId)}`, { method: "DELETE" }));
  },
  async premiumDues(filter = {}) {
    const q = [filter.holdingId ? `holdingId=${enc(filter.holdingId)}` : "", filter.state ? `state=${enc(filter.state)}` : ""].filter(Boolean).join("&");
    return parse(duesIn, await call(`/api/app/covers/premium-dues${q ? `?${q}` : ""}`)).dues;
  },
  async addPremiumDue(input) {
    return parse(dueView, await call("/api/app/covers/premium-dues", { method: "POST", json: input }));
  },
  async payPremiumDue(dueId, input) {
    return parse(dueView, await call(`/api/app/covers/premium-dues/${enc(dueId)}/pay`, { method: "POST", json: input }));
  },
  async hospitals(holdingId, pincode) {
    return parse(hospitalsIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/hospitals?pincode=${enc(pincode)}`)).hospitals;
  },
};
