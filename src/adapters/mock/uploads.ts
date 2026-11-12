import { AdapterError } from "../types";
import { DOCUMENT_KINDS, MAX_UPLOAD_BYTES, POLICY_TYPES, deriveView, type DocView, type ProgressCode } from "../documents-contract";
import type { UploadAdapter } from "../uploads";
import { precheck } from "../uploads";
import { delay } from "./delay";

// In-memory stand-in for the documents BFF, with its rules: the go-ahead first, a policy type, one case per household, a retry-safe key,
// and the same four-step progress per document (uploaded, scanned, reading, cover details). Each advance moves a document one step.
// A schedule and a wording PDF can both be added to the one policy. Fictional, no file content is kept.

type Entry = { id: string; kind: string; size: number; key: string; stage: number; at: string };
let consent = false;
let policyType: (typeof POLICY_TYPES)[number] | null = null;
const docs: Entry[] = [];
let n = 0;

const viewOf = (e: Entry): DocView => {
  const reading: ProgressCode = e.stage === 0 ? "running" : "done";
  const structuring: ProgressCode = e.stage <= 1 ? "running" : "done";
  return deriveView({ id: e.id, documentKind: e.kind, byteSize: e.size, status: "accepted", uploadedAt: e.at }, reading, structuring);
};
const need = () => { if (!consent) throw new AdapterError("CONSENT_REQUIRED"); };

export const mockUploads: UploadAdapter = {
  list: () => delay({ consent, documents: docs.map(viewOf), largeUpload: false, policyType }),
  async grantConsent() { consent = true; },
  async revokeConsent() { consent = false; docs.length = 0; policyType = null; },
  async upload(file, kind, key, type) {
    need();
    const pre = precheck(file, MAX_UPLOAD_BYTES);
    if (pre) throw new AdapterError(pre);
    if (!(DOCUMENT_KINDS as readonly string[]).includes(kind) || !POLICY_TYPES.includes(type)) throw new AdapterError("INVALID_INPUT");
    const same = docs.find((d) => d.key === key);
    if (same) return viewOf(same);
    if (docs.some((d) => d.kind === kind && kind !== "endorsement")) throw new AdapterError("DUPLICATE_DOCUMENT");
    policyType ??= type;
    n += 1;
    const e: Entry = { id: `doc-mock-${n}`, kind, size: file.size, key, stage: 0, at: new Date().toISOString() };
    docs.push(e);
    return delay(viewOf(e));
  },
  async advance(id) {
    need();
    const e = docs.find((d) => d.id === id);
    if (!e) throw new AdapterError("NOT_FOUND");
    if (e.stage < 2) e.stage += 1;
    return delay(viewOf(e));
  },
  async remove(id) {
    const i = docs.findIndex((d) => d.id === id);
    if (i < 0) throw new AdapterError("NOT_FOUND");
    docs.splice(i, 1);
  },
};
