import { z } from "zod";

// Wire contract of /api/app/documents/*. Shared by the BFF routes (input allow-lists, response shape) and the browser adapter.
// Legal review: the reading-consent wording shown to the person is DRAFT and not final.

/** Vercel functions accept a 4.5 MB request body. The upload stays under it with room for headers. Larger PDFs need the handoff in docs/upload-large-pdf.md. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** The backend accepts 15 MB. PDFs between 4 and 15 MB take the Blob handoff (docs/upload-large-pdf.md) when the server has a Blob store. */
export const MAX_LARGE_UPLOAD_BYTES = 15 * 1024 * 1024;
/** A client upload token lives this long. */
export const BLOB_TOKEN_TTL_MS = 5 * 60_000;
/** Blob names under the household folder: random, PDF only. The folder itself is issued by the server. */
export const BLOB_NAME = /^[A-Za-z0-9_-]{8,100}\.pdf$/;
export const BLOB_PREFIX = /^uploads\/[a-f0-9]{24}\/$/;
export const DOCUMENT_KINDS = ["policy_wording", "policy_schedule", "endorsement"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * What kind of policy the person says this is. Required before an upload. The backend (CoverSaath src/contracts/policy-type.js) owns
 * the same list and rejects anything else with POLICY_TYPE_INVALID; keep the two in step.
 */
export const POLICY_TYPES = ["personal_health", "group_health", "term_life", "other"] as const;
export const policyType = z.enum(POLICY_TYPES);
export type PolicyType = z.infer<typeof policyType>;
export const POLICY_TYPE_LABEL: Record<PolicyType, string> = { personal_health: "Personal health", group_health: "Group health", term_life: "Term life", other: "Other" };

export const STEP_STATES = ["pending", "active", "done", "failed", "unavailable"] as const;
export const stepState = z.enum(STEP_STATES);
export type StepState = z.infer<typeof stepState>;

/** What the person is told when a step stops. Closed set: backend text never reaches the page. */
export const DOC_NOTES = ["REJECTED", "QUARANTINED", "READING_FAILED", "READING_UNAVAILABLE", "STRUCTURING_FAILED", "STRUCTURING_PROVIDER_DOWN", "STRUCTURING_UNAVAILABLE", "DELETING"] as const;
export const docNote = z.enum(DOC_NOTES);
export type DocNote = z.infer<typeof docNote>;

/** Why the last structuring attempt stopped, from a closed set of backend failure codes. Never backend text. */
export const STRUCTURING_WHY = ["unavailable", "quota", "auth", "budget", "other"] as const;
export const structuringWhy = z.enum(STRUCTURING_WHY);
export type StructuringWhy = z.infer<typeof structuringWhy>;
/** Causes where an immediate new attempt would fail again (and cost a paid call). */
const PROVIDER_DOWN: ReadonlySet<StructuringWhy> = new Set(["unavailable", "quota", "auth", "budget"]);
/** After this long a provider-side stop is treated like any failure again, so the person can try once more. */
export const PROVIDER_RECHECK_AFTER_MS = 10 * 60_000;

/** Pure: backend `priorErrorCode` to the closed set. Anything unknown is "other". */
export function whyFromBackendCode(code: unknown): StructuringWhy {
  switch (code) {
    case "STRUCTURING_PROVIDER_UNAVAILABLE": return "unavailable";
    case "STRUCTURING_PROVIDER_QUOTA": return "quota";
    case "STRUCTURING_PROVIDER_AUTH": return "auth";
    case "STRUCTURING_BUDGET_REFUSED": return "budget";
    default: return "other";
  }
}

export const docView = z.object({
  id: z.string().min(1),
  kind: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.string().nullish(),
  steps: z.object({ uploaded: stepState, scanned: stepState, reading: stepState, structured: stepState }),
  note: docNote.nullable(),
  /** Set when the structuring step failed: the closed-set cause. Not shown as text. */
  why: structuringWhy.nullish(),
  /** True while the page should keep asking for progress. */
  busy: z.boolean(),
});
export type DocView = z.infer<typeof docView>;

export const listOut = z.object({ ok: z.literal(true), consent: z.boolean(), documents: z.array(docView), /** The type the case was started with, when the server knows it. The page keeps later uploads on the same type. */ policyType: policyType.nullish(), /** True when PDFs up to 15 MB can be added (a Blob store is set up). */ largeUpload: z.boolean().optional() });
export const blobInfoOut = z.object({ ok: z.literal(true), prefix: z.string().regex(BLOB_PREFIX) });
/** Body of POST /api/app/documents/from-blob. `pathname` is the blob the browser just uploaded. */
export const fromBlobIn = z.strictObject({
  pathname: z.string().max(200),
  filename: z.string().max(200),
  kind: z.enum(DOCUMENT_KINDS),
  policyType,
  key: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
});
export const oneOut = z.object({ ok: z.literal(true), document: docView });
export const consentOut = z.object({ ok: z.literal(true), consent: z.boolean() });
export const deleteOut = z.object({ ok: z.literal(true) });
export const consentPut = z.strictObject({ accept: z.literal(true), requestId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/) });

export type ProgressCode = "none" | "running" | "done" | "failed" | "unavailable";

/** How long a document may sit unscanned before the page says the check is not running (the file stays quarantined). */
export const QUARANTINE_AFTER_MS = 2 * 60_000;

type BackendDoc = { id: string; documentKind: string; byteSize: number; status: string; uploadedAt?: string | null };

/** Pure: the backend document plus what the BFF knows about reading and structuring becomes the four-step view. */
export function deriveView(doc: BackendDoc, reading: ProgressCode, structuring: ProgressCode, now = Date.now(), failure: { why?: StructuringWhy | null; failedAt?: number | null } = {}): DocView {
  const base = { id: doc.id, kind: doc.documentKind, sizeBytes: doc.byteSize, uploadedAt: doc.uploadedAt ?? null };
  const view = (steps: DocView["steps"], note: DocNote | null, busy: boolean): DocView => ({ ...base, steps, note, busy });
  const start: DocView["steps"] = { uploaded: "done", scanned: "pending", reading: "pending", structured: "pending" };
  if (doc.status === "deletion_pending") return view({ ...start, scanned: "done" }, "DELETING", true);
  if (doc.status === "rejected") return view({ ...start, scanned: "failed" }, "REJECTED", false);
  if (doc.status !== "accepted") {
    const age = doc.uploadedAt ? now - Date.parse(doc.uploadedAt) : 0;
    if (age > QUARANTINE_AFTER_MS) return view({ ...start, scanned: "unavailable" }, "QUARANTINED", true);
    return view({ ...start, scanned: "active" }, null, true);
  }
  const steps: DocView["steps"] = { ...start, scanned: "done" };
  if (reading === "none" || reading === "running") return view({ ...steps, reading: "active" }, null, true);
  if (reading === "failed") return view({ ...steps, reading: "failed" }, "READING_FAILED", false);
  if (reading === "unavailable") return view({ ...steps, reading: "unavailable" }, "READING_UNAVAILABLE", false);
  steps.reading = "done";
  if (structuring === "none" || structuring === "running") return view({ ...steps, structured: "active" }, null, true);
  if (structuring === "failed") {
    const why = failure.why ?? null;
    const recent = why !== null && PROVIDER_DOWN.has(why) && (failure.failedAt == null || now - failure.failedAt < PROVIDER_RECHECK_AFTER_MS);
    return { ...view({ ...steps, structured: "failed" }, recent ? "STRUCTURING_PROVIDER_DOWN" : "STRUCTURING_FAILED", false), why };
  }
  if (structuring === "unavailable") return view({ ...steps, structured: "unavailable" }, "STRUCTURING_UNAVAILABLE", false);
  return view({ ...steps, structured: "done" }, null, false);
}

/** Client-safe copy per code. Plain wording, no backend text. */
export const NOTE_TEXT: Record<DocNote, string> = {
  REJECTED: "This file could not be accepted. Try another copy of the policy.",
  QUARANTINED: "Saved and held aside. The security check is not running right now, so we have not opened it. We will pick it up when the check is back.",
  READING_FAILED: "We could not read this document. You can try again.",
  READING_UNAVAILABLE: "Saved safely. Reading is not switched on yet, so nothing has been read.",
  STRUCTURING_FAILED: "We read the document but could not pull the cover details out of it. You can try again.",
  STRUCTURING_PROVIDER_DOWN: "We read the document, but the step that pulls out the cover details is not available right now. Check back in a little while.",
  STRUCTURING_UNAVAILABLE: "Read, but the cover details are not ready yet.",
  DELETING: "Deleting. This can take a minute.",
};

export const ERROR_TEXT: Record<string, string> = {
  CONSENT_REQUIRED: "We need your go-ahead first.",
  POLICY_TYPE_REQUIRED: "Choose the type of policy first.",
  FILE_TYPE_INVALID: "Only PDF files can be added.",
  FILE_TOO_LARGE: "That file is too big. Check the size limit shown above and try again.",
  FILE_EMPTY: "That file is empty.",
  DUPLICATE_DOCUMENT: "This document is already added.",
  PDF_PROTECTED: "This PDF is password protected. Remove the password and try again.",
  PDF_UNREADABLE: "We could not open this PDF. Try another copy.",
  PDF_ACTIVE_CONTENT: "This PDF has a fillable form or scripts inside, which we cannot accept. Open it, choose Print, then Save as PDF (in Preview on Mac or in Chrome), and add that new copy.",
  PDF_TOO_LONG: "This PDF has more pages than we can read at once. Add the pages that hold the cover details as a smaller PDF.",
  PDF_TOO_COMPLEX: "This PDF is built in a way we cannot read safely. Open it, choose Print, then Save as PDF, and add that new copy.",
  BLOB_MISSING: "The file did not arrive. Try adding it again.",
  UPLOAD_UNAVAILABLE: "Uploads are not available right now. Try again later.",
  RATE_LIMITED: "Too many requests. Wait a moment and try again.",
  BACKEND_BUSY: "We are busy. Try again in a few seconds.",
  BACKEND_UNREACHABLE: "We could not reach the service. Try again.",
  BACKEND_TIMEOUT: "That took too long. Try again.",
  UNAUTHENTICATED: "Please sign in again.",
  NOT_FOUND: "We could not find that document.",
  HOLDINGS_DISABLED: "Cover details are not switched on yet.",
  HOLDING_REGISTRY_UNAVAILABLE: "The list of insurers is not ready yet. Try again in a moment.",
  HOLDING_PRODUCT_UNSUPPORTED: "That plan cannot be chosen here. Pick another or choose Something else.",
  NOT_READY: "Still being read. Check again in a moment.",
  CONFLICT_ALREADY_RESOLVED: "This one is already settled.",
  CONFLICT_STALE: "Things changed while you were looking. Refresh and choose again.",
  NOT_AVAILABLE: "This part is not available yet.",
  MEMORY_DISABLED: "Questions about your cover are not switched on yet.",
  CHAT_STREAM_FAILED: "The answer stopped part way. Ask again.",
  DEMO_READ_ONLY: "Sign in with your own account to ask about your cover.",
  INVALID_INPUT: "Check what you entered and try again.",
  POLICY_PROFILE_VERSION_CONFLICT: "Things changed while you were looking. Refresh and try again.",
};
export const errorText = (code: string) => ERROR_TEXT[code] ?? "Something went wrong. Try again.";
