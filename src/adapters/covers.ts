import type { z } from "zod";
import { AdapterError, type CoversAdapter, type UploadStage } from "./types";
import type { DocView } from "./documents-contract";
import { MAX_UPLOAD_BYTES } from "./documents-contract";
import { backendUploads, precheck } from "./uploads";
import { candidatesIn, confirmedIn, conflictsIn, coverOut, declarationView, deletedOut, declarationsIn, dueView, duesIn, factsIn, holdingDocumentsIn, holdingsIn, linkedIn, memoryDocumentIn, premiumsIn, premiumView, resolvedIn } from "./covers-contract";
import { hospitalsIn } from "./chat-contract";

// Browser client for the same-origin cover BFF (/api/app/covers). It never sees the backend token or the backend: every call goes to
// this app's own routes. Uploads stay under the 4 MB the BFF takes (the large-file handoff is not used here).

const enc = encodeURIComponent;
const POLL_MS = 2000;
const POLL_TRIES = 8;
/** A 20-page PDF takes longer than the holding wait: reading is followed for about 90 s before the page says it is still reading. */
const READ_TRIES = 45;
/** Steps in a row that may time out or fail (retryable) before the follow-up gives up. */
const MAX_MISSES = 3;

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
/** The step the backend is on, from the polled document view. */
export const stageOf = (doc: Pick<DocView, "steps">): UploadStage =>
  doc.steps.scanned !== "done" ? "checking" : doc.steps.reading !== "done" ? "reading" : "details";

/** A stop the person must be told about: the file was refused, or reading cannot run. A failed cover-details step is not one: the holding comes from the reading. */
export const stopCode = (doc: Pick<DocView, "steps" | "note">): string | null => {
  if (doc.note === "REJECTED") return "DOCUMENT_REJECTED";
  if (doc.note === "READING_FAILED" || doc.note === "READING_UNAVAILABLE") return doc.note;
  return null;
};

/** Follows one document through the backend steps until it stops being busy, or about 90 s pass. `busy` stays true when it is still being read. */
async function follow(first: DocView, onStage?: (stage: UploadStage) => void): Promise<{ documentId: string; busy: boolean }> {
  let doc = first;
  onStage?.(stageOf(doc));
  let misses = 0;
  for (let i = 0; i < READ_TRIES && doc.busy && !stopCode(doc); i += 1) {
    await wait(POLL_MS);
    try {
      doc = await backendUploads.advance(doc.id);
      misses = 0;
    } catch (e) {
      // One timed-out or failed step must not end the follow-up: ask again. Three in a row, or a refusal, is a real stop.
      if (!(e instanceof AdapterError && e.retryable) || (misses += 1) >= MAX_MISSES) throw e;
      continue;
    }
    onStage?.(stageOf(doc));
  }
  const stop = stopCode(doc);
  if (stop) throw new AdapterError(stop, stop === "READING_FAILED");
  return { documentId: doc.id, busy: doc.busy };
}

export const backendCovers: CoversAdapter = {
  async uploadDocument(file, key, kind, policyType, onStage) {
    const pre = precheck(file, MAX_UPLOAD_BYTES);
    if (pre) throw new AdapterError(pre);
    onStage?.("sending");
    const doc = await backendUploads.upload(file, kind, key, policyType);
    // The same key again returns the same document: a reading that failed last time is started again here, once, on the person's Try again.
    return follow(doc.note === "READING_FAILED" ? await backendUploads.advance(doc.id, true) : doc, onStage);
  },
  async resumeDocument(documentId, onStage) {
    return follow(await backendUploads.advance(documentId), onStage);
  },
  async holdingFor(documentId) {
    // The backend makes the holding; the page waits a little for it, then lets the person check again.
    for (let i = 0; i < POLL_TRIES; i += 1) {
      const view = await this.holdingsView();
      const found = view.holdings.find((h) => h.documentId === documentId);
      if (found) return found.id;
      // Gave up: no point waiting. `retrying` just keeps waiting.
      if (view.creationIssues.some((x) => x.documentId === documentId && x.state === "failed")) throw new AdapterError("HOLDING_CREATE_FAILED");
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
    return (await this.holdingsView()).holdings;
  },
  async holdingsView() {
    const r = parse(holdingsIn, await call("/api/app/covers/holdings"));
    return { holdings: r.holdings, creationIssues: r.creationIssues ?? [] };
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
  async memoryDocument(holdingId) {
    return parse(memoryDocumentIn, await call(`/api/app/covers/holdings/${enc(holdingId)}/memory-document`)).markdown;
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
