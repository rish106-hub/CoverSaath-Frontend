import { z } from "zod";

// Wire contract of the cover routes under /api/app/covers (holdings, product candidates, confirm, facts, conflicts, declarations,
// premiums). Shared by the BFF routes (input allow-lists, response shaping) and the browser adapter. It mirrors the backend bodies in
// CoverSaath src/contracts/holdings.js, src/contracts/policy-facts.js and the holdings routes. zod objects drop unknown keys, so a
// field the backend adds later (a UIN, a cache key) never reaches the page. Money is in paise. No model decides anything here:
// statuses come from deterministic backend code and the page shows them as given.

export const PATH_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const id = z.string().min(1).max(128).regex(PATH_ID);

export const HOLDING_STATUSES = ["uploaded", "insurer_pending", "product_reported", "parsed", "conflicts", "ready"] as const;
export type HoldingStatus = (typeof HOLDING_STATUSES)[number];
export const RESOLVED_STATUSES = ["extracted_unverified", "conflicting", "unknown", "reviewed_reference", "user_confirmed"] as const;
export type ResolvedStatus = (typeof RESOLVED_STATUSES)[number];
export const FACT_GROUPS = ["limits", "waiting", "exclusions", "cashless", "money"] as const;

/** A UIN is service-only. If one ever appears in a body the BFF is about to forward, the body is refused. */
const UIN_SHAPE = /\b[A-Z]{3,8}[A-Z]{1,2}\d{2,6}V\d{6}\b/;
export const containsUin = (body: unknown): boolean => UIN_SHAPE.test(JSON.stringify(body) ?? "");

// ---- Holdings ------------------------------------------------------------------------------------------------------------

export const holdingView = z.object({ id, documentId: id.nullish(), kind: z.string().max(60).nullish(), status: z.enum(HOLDING_STATUSES) });
export type HoldingView = z.infer<typeof holdingView>;
export const holdingsIn = z.object({ holdings: z.array(holdingView).max(200), truncated: z.boolean().optional() });

/** Insurer and product name only. Never a UIN. */
export const candidateView = z.object({ candidateId: id, insurerName: z.string().max(200), productName: z.string().max(200), rank: z.number().int().min(0).max(100) });
export type CandidateView = z.infer<typeof candidateView>;
export const candidatesIn = z.object({ holdingId: id, profileVersion: z.number().int().min(0), candidates: z.array(candidateView).max(10) });
export type Candidates = z.infer<typeof candidatesIn>;

// ---- Documents of a holding (two-document holding: schedule makes the holding, the terms and conditions link to it) ---------

export const HOLDING_DOCUMENT_KINDS = ["wording", "endorsement", "other"] as const;
export type HoldingDocumentKind = (typeof HOLDING_DOCUMENT_KINDS)[number];
/** Body of POST /api/app/covers/holdings/{id}/documents. Strict: a stray key is a 400. */
export const linkDocumentIn = z.object({ documentId: id, kind: z.enum(HOLDING_DOCUMENT_KINDS).default("wording") }).strict();
export type LinkDocumentInput = z.input<typeof linkDocumentIn>;
export const holdingDocumentsIn = z.object({ holdingId: id, documents: z.array(z.object({ documentId: id, kind: z.string().max(40) })).max(50) });
export type HoldingDocuments = z.infer<typeof holdingDocumentsIn>;
export const linkedIn = z.object({ holdingId: id, documentId: id, kind: z.string().max(40), linked: z.boolean() });
export type Linked = z.infer<typeof linkedIn>;

export const confirmProductIn = z.object({ candidateId: id, expectedVersion: z.number().int().min(0).max(1_000_000) }).strict();
export type ConfirmProduct = z.infer<typeof confirmProductIn>;
export const confirmedIn = z.object({ holdingId: id, status: z.enum(HOLDING_STATUSES), profileVersion: z.number().int().min(0), replay: z.boolean() });
export type Confirmed = z.infer<typeof confirmedIn>;

// ---- Facts and conflicts -------------------------------------------------------------------------------------------------

const status = z.enum(RESOLVED_STATUSES);
const page = z.object({ pageId: z.string().max(128), blockIndex: z.number().int().nullish() }).nullish();
/** One reading of a fact in one tier (own PDF, insurer wording, your declaration). `value` is whatever the backend typed it as. */
export const sourceView = z.object({
  id: z.string().max(128),
  tier: z.enum(["own_pdf", "ida_wording", "user_declaration"]).optional(),
  status: status.optional(),
  value: z.unknown().optional(),
  page,
  quote: z.string().max(2000).nullish(),
  captureMethod: z.string().max(60).nullish(),
  current: z.boolean().optional(),
});
export type SourceView = z.infer<typeof sourceView>;

export const factView = z.object({
  factKey: z.string().max(80),
  factClass: z.string().max(40).nullish(),
  valueType: z.string().max(20).nullish(),
  unit: z.string().max(20).nullish(),
  group: z.string().max(40).nullish(),
  status,
  value: z.unknown().optional(),
  sourceTier: z.string().max(40).nullish(),
  alternatives: z.array(z.unknown()).max(20).default([]),
  checkWithInsurer: z.boolean().default(false),
  openConflictId: z.string().max(128).nullish(),
  sources: z.array(sourceView).max(10).default([]),
});
export type FactView = z.infer<typeof factView>;
export const factsIn = z.object({ holdingId: id, status: z.enum(HOLDING_STATUSES), facts: z.array(factView).max(400), unknownKeys: z.array(z.string().max(80)).max(400).default([]) });
export type Facts = z.infer<typeof factsIn>;

export const conflictView = z.object({
  id: z.string().max(128),
  factKey: z.string().max(80),
  factClass: z.string().max(40).nullish(),
  valueType: z.string().max(20).nullish(),
  reason: z.string().max(40),
  resolution: z.string().max(40),
  resolvedAt: z.string().max(60).nullish(),
  resolvingFactId: z.string().max(128).nullish(),
  /** FOR LEGAL REVIEW: on a product term the owner's choice is a statement; the insurer's wording still governs. */
  checkWithInsurer: z.boolean().default(false),
  candidates: z.array(sourceView).max(10).default([]),
});
export type ConflictView = z.infer<typeof conflictView>;
export const conflictsIn = z.object({ holdingId: id, status: z.enum(HOLDING_STATUSES), conflicts: z.array(conflictView).max(200) });
export type Conflicts = z.infer<typeof conflictsIn>;

export const resolveConflictIn = z.object({ chosenFactId: id, alternativeIndex: z.number().int().min(0).max(9).optional() }).strict();
export type ResolveConflict = z.infer<typeof resolveConflictIn>;
export const resolvedIn = z.object({ conflictId: z.string().max(128), resolvingFactId: z.string().max(128), status: z.literal("user_confirmed"), holdingStatus: z.enum(HOLDING_STATUSES), replay: z.boolean() });
export type Resolved = z.infer<typeof resolvedIn>;

// ---- Declarations and premiums (CoverSaath #104: household-scoped routes; input allow-lists mirror the backend) -----------------

export const DECLARATION_KINDS = ["pre_existing_disease", "prior_condition", "habit", "occupation", "nominee", "other"] as const;
export type DeclarationKind = (typeof DECLARATION_KINDS)[number];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const declarationIn = z
  .object({
    memberId: id,
    kind: z.enum(DECLARATION_KINDS),
    label: z.string().trim().min(1).max(500),
    declaredOn: day.nullable().default(null),
    declaredToInsurer: z.boolean().nullable().default(null),
    holdingId: id.nullable().default(null),
  })
  .strict();
export type DeclarationInput = z.input<typeof declarationIn>;
export const declarationView = z.object({
  id: z.string().max(128), memberId: z.string().max(128), holdingId: z.string().max(128).nullish(), kind: z.enum(DECLARATION_KINDS),
  label: z.string().max(500), declaredOn: z.string().max(20).nullish(), declaredToInsurer: z.boolean().nullish(), revision: z.number().int().nullish(),
});
export type DeclarationView = z.infer<typeof declarationView>;
/** Edit of an existing declaration. `ifMatch` is the revision the person saw; a stale one is REVISION_CONFLICT. */
export const declarationUpdateIn = z
  .object({
    label: z.string().trim().min(1).max(500),
    declaredOn: day.nullable().default(null),
    declaredToInsurer: z.boolean().nullable().default(null),
    ifMatch: z.number().int().min(0).optional(),
  })
  .strict();
export type DeclarationUpdateInput = z.input<typeof declarationUpdateIn>;

export const PAYMENT_CHANNELS = ["upi", "card", "netbanking", "cheque", "cash", "salary_deduction", "unknown"] as const;
export const PAID_VIA = ["self", "agent", "employer", "bank"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];
export type PaidVia = (typeof PAID_VIA)[number];
export const premiumIn = z
  .object({
    holdingId: id,
    amountPaise: z.number().int().min(1).max(100_000_000_000),
    paidOn: day,
    channel: z.enum(PAYMENT_CHANNELS).default("unknown"),
    paidVia: z.enum(PAID_VIA).default("self"),
    payerMemberId: id.nullable().default(null),
    agentName: z.string().trim().min(1).max(120).nullable().default(null),
    agentCode: z.string().trim().min(1).max(120).nullable().default(null),
  })
  .strict()
  .refine((v) => (v.agentName === null && v.agentCode === null) || v.paidVia === "agent", { message: "agent only when paidVia is agent" });
export type PremiumInput = z.input<typeof premiumIn>;
export const premiumView = z.object({
  id: z.string().max(128), holdingId: z.string().max(128), amountPaise: z.number().int(), paidOn: z.string().max(20),
  channel: z.string().max(30), paidVia: z.string().max(20), agentName: z.string().max(120).nullish(), agentCode: z.string().max(120).nullish(),
});
export type PremiumView = z.infer<typeof premiumView>;

export const DUE_STATES = ["expected", "paid", "overdue"] as const;
export type DueState = (typeof DUE_STATES)[number];
export const dueIn = z
  .object({ holdingId: id, dueOn: day, amountPaise: z.number().int().min(1).max(100_000_000_000) })
  .strict();
export type DueInput = z.input<typeof dueIn>;
export const dueView = z.object({
  id: z.string().max(128), holdingId: z.string().max(128), dueOn: z.string().max(20), amountPaise: z.number().int(),
  state: z.enum(DUE_STATES), paidPaymentId: z.string().max(128).nullish(),
});
export type DueView = z.infer<typeof dueView>;
export const payDueIn = z.object({ paymentId: id }).strict();
export type PayDueInput = z.input<typeof payDueIn>;
export const declarationsIn = z.object({ declarations: z.array(declarationView).max(500) });
export const premiumsIn = z.object({ premiums: z.array(premiumView).max(500) });
export const duesIn = z.object({ dues: z.array(dueView).max(500) });
export const deletedOut = z.object({ deleted: z.literal(true) });

/** What every cover route answers: `{ ok: true, data }`. */
export const coverOut = z.object({ ok: z.literal(true).optional(), data: z.unknown() });
