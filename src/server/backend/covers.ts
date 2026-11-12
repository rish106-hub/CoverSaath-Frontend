import "server-only";
import type { z } from "zod";
import { AppError } from "./errors";
import { need, withDocuments, withReadGrant, type Ctx } from "./documents";
import { containsUin, candidatesIn, confirmedIn, conflictsIn, declarationIn, holdingDocumentsIn, linkDocumentIn, linkedIn, declarationsIn, declarationUpdateIn, declarationView, deletedOut, DUE_STATES, dueIn, duesIn, dueView, factsIn, holdingsIn, PATH_ID, payDueIn, premiumIn, premiumsIn, premiumView, resolvedIn, type ConfirmProduct, type ResolveConflict } from "@/adapters/covers-contract";

// BFF for the cover screens: holdings, product candidates, confirm product, facts, conflicts and their resolution, declarations,
// premiums and dues and dues (CoverSaath /api/v1/holdings and /api/v1/households/{id}/...). Server only. The backend token stays in the sealed
// session cookie and is read here, never by a client component. Every body is parsed against the contract before it leaves, so a
// field the contract does not name is dropped, and a body that still looks like it holds a UIN is refused. Deterministic backend
// code owns consent, eligibility and release; nothing here upgrades a status.
// Legal review: the wording around a choice on a product term ("check with the insurer") is FOR LEGAL REVIEW, not final.

export const withCovers = (req: Request, run: (ctx: Ctx) => Promise<unknown>, status = 200): Promise<Response> => withDocuments(req, run, status, { strict401: true });

const enc = encodeURIComponent;
const out = (data: unknown): { data: unknown } => ({ data });

/** Parses a backend body against its contract. Unknown keys are dropped; anything that looks like a UIN is refused. */
function shape<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const r = schema.safeParse(body);
  if (!r.success) throw new AppError(502, "BACKEND_BAD_RESPONSE");
  if (containsUin(r.data)) throw new AppError(502, "BACKEND_BAD_RESPONSE");
  return r.data;
}

export async function listHoldings(ctx: Ctx): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("GET", `/api/v1/households/${enc(ctx.session.h)}/holdings`, ctx.session.t);
  // The backend's `creation_issues` (snake_case) is the same list as `creationIssues`; older backends send neither.
  const body = r.body && typeof r.body === "object" && "creation_issues" in r.body && !("creationIssues" in r.body) ? { ...(r.body as object), creationIssues: (r.body as { creation_issues: unknown }).creation_issues } : r.body;
  return out(shape(holdingsIn, body));
}

/** Up to three candidates: insurer and product name, nothing else. The page confirms one by `candidateId`. */
export async function getCandidates(ctx: Ctx, holdingId: string): Promise<{ data: unknown }> {
  need(ctx.session);
  // Reads the document's first pages on the backend, so it runs under the reading go-ahead like the other document reads.
  const r = await withReadGrant(ctx, () => ctx.client.send("GET", `/api/v1/holdings/${enc(holdingId)}/product-candidates`, ctx.session.t, { timeoutMs: 15_000 }));
  return out(shape(candidatesIn, r.body));
}

/** The owner's statement of which product this is. Repeats safely: the same Idempotency-Key is the same statement. */
export async function confirmProduct(ctx: Ctx, holdingId: string, statement: ConfirmProduct, key: string): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `/api/v1/holdings/${enc(holdingId)}/confirm-product`, ctx.session.t, { json: statement, headers: { "idempotency-key": key } });
  return out(shape(confirmedIn, r.body));
}

export async function getFacts(ctx: Ctx, holdingId: string): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("GET", `/api/v1/holdings/${enc(holdingId)}/facts`, ctx.session.t);
  return out(shape(factsIn, r.body));
}

/** Documents linked to one holding: the schedule that made it and any terms and conditions added after. */
export async function listHoldingDocuments(ctx: Ctx, holdingId: string): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("GET", `/api/v1/holdings/${enc(holdingId)}/documents`, ctx.session.t);
  return out(shape(holdingDocumentsIn, r.body));
}

/** Links an uploaded document to a holding. Repeats safely: the backend answers linked false for a document already linked. */
export async function linkHoldingDocument(ctx: Ctx, holdingId: string, body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `/api/v1/holdings/${enc(holdingId)}/documents`, ctx.session.t, { json: input(linkDocumentIn, body) });
  return out(shape(linkedIn, r.body));
}

export async function getConflicts(ctx: Ctx, holdingId: string): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("GET", `/api/v1/holdings/${enc(holdingId)}/conflicts`, ctx.session.t);
  return out(shape(conflictsIn, r.body));
}

/** The owner's choice. Stored by the backend as their own statement; the machine readings stay. */
export async function resolveConflict(ctx: Ctx, holdingId: string, conflictId: string, choice: ResolveConflict): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `/api/v1/holdings/${enc(holdingId)}/conflicts/${enc(conflictId)}/resolve`, ctx.session.t, { json: choice });
  return out(shape(resolvedIn, r.body));
}

// ---- Declarations, premiums, dues (CoverSaath #104) ---------------------------------------------------------------------------
// Household-scoped backend routes. Off unless the backend's HOLDINGS_ENABLED is on: 503 HOLDINGS_DISABLED comes back as the coded
// HOLDINGS_DISABLED. The write consent (purpose profile_intake) is resolved by the backend itself; no grant id is sent from here, and a
// missing one is the coded CONSENT_REQUIRED (403). Inputs are checked against the contract first, so a stray key is a 400 here.
// Legal review: the consent grant, notice and wording for these records are FOR LEGAL REVIEW, not final.

const hh = (ctx: Ctx): string => `/api/v1/households/${enc(ctx.session.h)}`;
const filterId = (v: string | null): string | null => {
  if (v === null || v === "") return null;
  if (!PATH_ID.test(v)) throw new AppError(400, "INVALID_INPUT");
  return v;
};
const qs = (o: Record<string, string | null>): string => {
  const e = Object.entries(o).filter((x): x is [string, string] => x[1] !== null);
  return e.length ? `?${e.map(([k, v]) => `${k}=${enc(v)}`).join("&")}` : "";
};
const input = <T extends z.ZodType>(schema: T, body: unknown): z.output<T> => {
  const r = schema.safeParse(body);
  if (!r.success) throw new AppError(400, "INVALID_INPUT");
  return r.data;
};

export async function listDeclarations(ctx: Ctx, memberId: string | null): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("GET", `${hh(ctx)}/declarations${qs({ memberId: filterId(memberId) })}`, ctx.session.t);
  return out(shape(declarationsIn, r.body));
}
export async function createDeclaration(ctx: Ctx, body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `${hh(ctx)}/declarations`, ctx.session.t, { json: input(declarationIn, body) });
  return out(shape(declarationView, r.body));
}
export async function updateDeclaration(ctx: Ctx, declarationId: string, body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("PUT", `${hh(ctx)}/declarations/${enc(declarationId)}`, ctx.session.t, { json: input(declarationUpdateIn, body) });
  return out(shape(declarationView, r.body));
}
export async function deleteDeclaration(ctx: Ctx, declarationId: string): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("DELETE", `${hh(ctx)}/declarations/${enc(declarationId)}`, ctx.session.t);
  return out(shape(deletedOut, r.body));
}

export async function listPremiums(ctx: Ctx, holdingId: string | null): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("GET", `${hh(ctx)}/premiums${qs({ holdingId: filterId(holdingId) })}`, ctx.session.t);
  return out(shape(premiumsIn, r.body));
}
export async function createPremium(ctx: Ctx, body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `${hh(ctx)}/premiums`, ctx.session.t, { json: input(premiumIn, body) });
  return out(shape(premiumView, r.body));
}
export async function deletePremium(ctx: Ctx, paymentId: string): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("DELETE", `${hh(ctx)}/premiums/${enc(paymentId)}`, ctx.session.t);
  return out(shape(deletedOut, r.body));
}

export async function listDues(ctx: Ctx, holdingId: string | null, state: string | null): Promise<{ data: unknown }> {
  need(ctx.session);
  if (state !== null && !(DUE_STATES as readonly string[]).includes(state)) throw new AppError(400, "INVALID_INPUT");
  const r = await ctx.client.send("GET", `${hh(ctx)}/premium-dues${qs({ holdingId: filterId(holdingId), state })}`, ctx.session.t);
  return out(shape(duesIn, r.body));
}
export async function createDue(ctx: Ctx, body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `${hh(ctx)}/premium-dues`, ctx.session.t, { json: input(dueIn, body) });
  return out(shape(dueView, r.body));
}
export async function payDue(ctx: Ctx, dueId: string, body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `${hh(ctx)}/premium-dues/${enc(dueId)}/pay`, ctx.session.t, { json: input(payDueIn, body) });
  return out(shape(dueView, r.body));
}
