import "server-only";
import type { z } from "zod";
import { AppError } from "./errors";
import { need, withDocuments, withReadGrant, type Ctx } from "./documents";
import { containsUin, candidatesIn, confirmedIn, conflictsIn, declarationIn, factsIn, holdingsIn, premiumIn, resolvedIn, type ConfirmProduct, type ResolveConflict } from "@/adapters/covers-contract";

// BFF for the cover screens: holdings, product candidates, confirm product, facts, conflicts and their resolution, declarations and
// premiums (CoverSaath /api/v1/holdings and /api/v1/households/{id}/holdings). Server only. The backend token stays in the sealed
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
  return out(shape(holdingsIn, r.body));
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

// ---- Declarations and premiums: BACKEND ROUTE MISSING ------------------------------------------------------------------------
// The backend has repositories (declaration-repository.js, premium-repository.js) but no HTTP route yet. These handlers check the
// input against the repository's own rules and then answer a coded NOT_AVAILABLE (501) without calling the backend. Nothing is
// stored and no path is guessed. Replace the throw with a send() when the routes exist; the mock adapter already stores in memory.

const missing = (): never => {
  throw new AppError(501, "NOT_AVAILABLE");
};

export async function declarationsRoute(ctx: Ctx, method: "GET" | "POST", body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  if (method === "POST" && !declarationIn.safeParse(body).success) throw new AppError(400, "INVALID_INPUT");
  return missing();
}

export async function premiumsRoute(ctx: Ctx, method: "GET" | "POST", body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  if (method === "POST" && !premiumIn.safeParse(body).success) throw new AppError(400, "INVALID_INPUT");
  return missing();
}
