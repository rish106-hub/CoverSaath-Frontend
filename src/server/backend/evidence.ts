import "server-only";
import { createHash } from "node:crypto";
import { AppError } from "./errors";
import { gen, need, withDocuments, withReadGrant, writeDocsState, type Ctx } from "./documents";
import { PATH_ID, IDEMPOTENCY_KEY, type AskQuestion, type CatalogueReview, type ConfirmPolicyProfile, type CoveragePreview, type HandoffQuery, type PassThrough } from "@/adapters/evidence-contract";

// BFF for the evidence routes: policy profile, questions with quotes, decision catalogue, coverage preview, source pack, deletion
// inventory and integrations (CoverSaath /api/v1). Server only. This is the one BFF: the website no longer proxies the backend.
// The backend token stays in the sealed session cookie and is read here, never by a client component. Bodies are passed through;
// deterministic backend code owns consent, eligibility, money and release, and nothing here upgrades an answer. Legal review:
// the question-consent purpose and recipient are not final.

const GEMINI = "google-gemini";
/** Grants for questions kept in the sealed state. Room is proven before a grant is made, so a made grant is never forgotten. */
const MAX_QUESTION_GRANTS = 6;
const QUESTION_TIMEOUT_MS = 30_000;

/** Same wrapper as the documents routes (origin guard, sealed session, coded failures) but a plain 401 does not end the session. */
export const withEvidence = (req: Request, run: (ctx: Ctx) => Promise<unknown>, status = 200): Promise<Response> =>
  withDocuments(req, run, status, { strict401: true });

export const pathId = (value: string | undefined): string => {
  if (!value || !PATH_ID.test(value)) throw new AppError(400, "INVALID_INPUT");
  return value;
};

/** The backend has no route that lists cases, so the case this session made is the only one it may read through the BFF. */
function ownCase(ctx: Ctx, caseId: string): string {
  if (!ctx.state.c || ctx.state.c !== caseId) throw new AppError(404, "NOT_FOUND");
  return caseId;
}

export const idempotencyKey = (req: Request): string => {
  const key = req.headers.get("idempotency-key")?.trim() ?? "";
  if (!IDEMPOTENCY_KEY.test(key)) throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED");
  return key;
};

const enc = encodeURIComponent;
type Out = { data: unknown };
const out = (data: unknown): Out => ({ data });

// ---- Policy profile (backend ADR 0024) ---------------------------------------------------------------------------------------

export async function getPolicyProfile(ctx: Ctx, documentId: string): Promise<Out> {
  need(ctx.session);
  const r = await withReadGrant(ctx, () => ctx.client.send("GET", `/api/v1/documents/${enc(documentId)}/policy-profile`, ctx.session.t));
  return out(r.body);
}

/** Repeats safely: the same Idempotency-Key is the same statement. A stale `expectedVersion` is refused by the backend. */
export async function confirmPolicyProfile(ctx: Ctx, documentId: string, statement: ConfirmPolicyProfile, key: string): Promise<Out> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `/api/v1/documents/${enc(documentId)}/policy-profile/confirm`, ctx.session.t, { json: statement, headers: { "idempotency-key": key } });
  return out(r.body);
}

// ---- Questions ---------------------------------------------------------------------------------------------------------------

/**
 * One question about the case's documents. The grant for sending their text to the model is made here, per document set, with a
 * replay-safe key, and tracked in the sealed state so withdrawing the reading consent revokes it. Needs the reading go-ahead first.
 */
export async function askQuestion(ctx: Ctx, caseId: string, input: AskQuestion, key: string): Promise<Out> {
  const adultId = need(ctx.session);
  ownCase(ctx, caseId);
  if (!ctx.state.g) throw new AppError(403, "CONSENT_REQUIRED");
  // Only documents of this case that the backend lists and has accepted can be named: ownership is proven before any grant is made.
  const listed = await withReadGrant(ctx, () => ctx.client.list(ctx.session.t, caseId));
  const accepted = new Set(listed.filter((d) => d.status === "accepted").map((d) => d.id));
  const documentIds = [...new Set(input.documentIds ?? [...accepted].slice(0, 10))].sort();
  if (documentIds.length === 0) throw new AppError(409, "NOT_READY");
  if (!documentIds.every((d) => accepted.has(d))) throw new AppError(404, "NOT_FOUND");

  const q = ctx.state.q ?? [];
  if (q.length >= MAX_QUESTION_GRANTS) throw new AppError(429, "RATE_LIMITED");
  const set = createHash("sha256").update(documentIds.join(",")).digest("hex").slice(0, 16);
  const grantId = await ctx.client.grant(ctx.session.t, {
    householdId: ctx.session.h, adultId, key: `ask-${caseId}-${set}-${gen(ctx.state)}`, purpose: "document_processing", grantedToActor: GEMINI,
    scope: { resourceType: "document", resourceId: documentIds[0] as string, action: "derive", dataCategory: "insurance_question", recipient: GEMINI },
    scopes: documentIds.map((resourceId) => ({ resourceType: "document", resourceId, action: "derive", dataCategory: "insurance_question", recipient: GEMINI })),
  });
  if (!q.includes(grantId)) {
    ctx.state.q = [...q, grantId];
    await writeDocsState(ctx.state, ctx.secret);
  }
  const r = await ctx.client.send("POST", `/api/v1/cases/${enc(caseId)}/questions`, ctx.session.t, {
    json: { question: input.question, consentGrantId: grantId, documentIds }, headers: { "idempotency-key": key }, timeoutMs: QUESTION_TIMEOUT_MS,
  });
  return out(r.body);
}

export async function getAnswer(ctx: Ctx, caseId: string, answerId: string): Promise<Out> {
  ownCase(ctx, caseId);
  const r = await withReadGrant(ctx, () => ctx.client.send("GET", `/api/v1/cases/${enc(caseId)}/questions/${enc(answerId)}`, ctx.session.t));
  return out(r.body);
}

// ---- Decision catalogue and review -------------------------------------------------------------------------------------------

export async function getHandoff(ctx: Ctx, caseId: string, query: HandoffQuery): Promise<Out> {
  ownCase(ctx, caseId);
  const params = new URLSearchParams({ format: "handoff" });
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const r = await withReadGrant(ctx, () => ctx.client.send("GET", `/api/v1/cases/${enc(caseId)}/decision-catalogue?${params}`, ctx.session.t));
  return out(r.body);
}

export async function reviewCatalogue(ctx: Ctx, caseId: string, review: CatalogueReview, key: string): Promise<Out> {
  need(ctx.session);
  ownCase(ctx, caseId);
  const r = await ctx.client.send("POST", `/api/v1/cases/${enc(caseId)}/decision-catalogue/reviews`, ctx.session.t, { json: review, headers: { "idempotency-key": key } });
  return out(r.body);
}

/** A person may name only themselves as a confirmer: the check is here, not left to the page. */
export async function designateConfirmer(ctx: Ctx, adultUserId: string): Promise<Out> {
  const adultId = need(ctx.session);
  if (adultUserId !== adultId) throw new AppError(403, "FORBIDDEN");
  const r = await ctx.client.send("POST", `/api/v1/households/${enc(ctx.session.h)}/catalogue-reviewers`, ctx.session.t, { json: { adultUserId } });
  return out(r.body);
}

export async function coveragePreview(ctx: Ctx, body: CoveragePreview): Promise<Out> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `/api/v1/households/${enc(ctx.session.h)}/coverage-preview`, ctx.session.t, { json: body });
  return out(r.body);
}

// ---- Source pack, deletion inventory, integrations ---------------------------------------------------------------------------

export async function getSourcePack(ctx: Ctx, caseId: string): Promise<Out> {
  ownCase(ctx, caseId);
  const r = await withReadGrant(ctx, () => ctx.client.send("GET", `/api/v1/cases/${enc(caseId)}/source-pack`, ctx.session.t));
  return out(r.body);
}

/** Needs no reading consent: after a withdrawal the person must still see, and be able to delete, what is held. */
export async function getDeletionInventory(ctx: Ctx, caseId: string): Promise<Out> {
  ownCase(ctx, caseId);
  const r = await ctx.client.send("GET", `/api/v1/cases/${enc(caseId)}/documents/deletion-inventory`, ctx.session.t);
  return out(r.body);
}

export async function getIntegrations(ctx: Ctx): Promise<Out> {
  const r = await ctx.client.send("GET", "/api/v1/integrations", ctx.session.t);
  return out(r.body);
}

export type { PassThrough };
