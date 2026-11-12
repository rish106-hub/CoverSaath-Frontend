import { z } from "zod";
import { PATH_ID } from "./covers-contract";

// Wire contract of the chat and hospital routes under /api/app (chat threads, streamed turns, hospitals by pincode). Shared by the BFF
// (input allow-lists, event shaping) and the browser adapter. It mirrors CoverSaath src/contracts/chat.js (chat v1, PR #102) and renames
// snake_case to camelCase at the BFF. zod objects drop unknown keys, so a field the backend adds later never reaches the page.
// Deterministic backend code decides; a model only drafts prose, and every answer names the facts it used. Money in `computed` is in paise.

const id = z.string().min(1).max(128).regex(PATH_ID);
export const CHAT_MESSAGE_MAX = 1000;
export const PINCODE = /^[1-9]\d{5}$/;

export const threadIn = z.object({ id, holdingId: id.nullish() });
export type ThreadView = z.infer<typeof threadIn>;

/** Structured inputs of a planned-procedure question. Amounts in whole rupees; the backend converts them. */
export const procedureIn = z.object({
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimatedCostInr: z.number().int().min(0).max(100_000_000),
  roomRentPerDayInr: z.number().int().min(0).max(10_000_000),
  stayDays: z.number().int().min(0).max(365),
}).strict();
export type ProcedureInput = z.infer<typeof procedureIn>;

/** What the page sends for one turn. `voice` means the message is the transcript of a spoken question. No audio is sent or kept here. */
export const turnIn = z.object({
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
  inputKind: z.enum(["text", "voice"]).default("text"),
  procedure: procedureIn.optional(),
}).strict();
export type TurnInput = z.input<typeof turnIn>;

export const FACT_STATUSES = ["extracted_unverified", "conflicting", "unknown", "reviewed_reference", "user_confirmed"] as const;
/** Where an answer or fact came from, when the backend names it: which of the policy's documents and which page. Additive and optional; the page is 1-based. */
export const citationView = z.object({
  documentKind: z.string().max(40).nullish(),
  documentId: z.string().max(128).nullish(),
  page: z.number().int().min(1).max(10_000).nullish(),
  quote: z.string().max(400).nullish(),
});
export type Citation = z.infer<typeof citationView>;

/** Backend answer sources: the insurer's wording the answer rests on. `ref` is the clause reference; the page is 1-based. */
export const sourceView = z.object({
  kind: z.string().max(40),
  document_id: z.string().max(128).nullish(),
  page: z.number().int().min(1).max(10_000).nullish(),
  ref: z.string().max(200).nullish(),
});
export type AnswerSource = z.infer<typeof sourceView>;

export const factUsed = z.object({
  factId: z.string().max(128),
  factKey: z.string().max(80),
  label: z.string().max(200),
  status: z.enum(FACT_STATUSES),
  sourceTier: z.string().max(40).nullish(),
  valueText: z.string().max(400).nullish(),
  /** Backend marks a product term where the insurer's own wording governs. */
  checkWithInsurer: z.boolean().default(false),
  citation: citationView.nullish(),
});
export type FactUsed = z.infer<typeof factUsed>;

const check = z.object({ id: z.string().max(80), status: z.enum(["ok", "attention", "info", "unknown"]), detail: z.string().max(600), factIds: z.array(z.string().max(128)).max(20).default([]) });
export const computedView = z.object({
  version: z.union([z.number(), z.string().max(20)]).optional(),
  checks: z.array(check).max(20),
  summary: z.object({ estimateMinor: z.number(), insurerShareMinor: z.number(), youPayMinor: z.number(), basis: z.string().max(200).nullish() }).nullish(),
  missingInputs: z.array(z.string().max(80)).max(20).default([]),
});
export type Computed = z.infer<typeof computedView>;

export const metaEvent = z.object({ threadId: z.string().max(128), intent: z.string().max(60), retrievalMode: z.enum(["vector", "keyword", "facts_only"]), factsAvailable: z.number().int().min(0).optional(), openConflicts: z.number().int().min(0).optional() });
export const deltaEvent = z.object({ text: z.string().max(2000) });
export const answerEvent = z.object({
  turnId: z.string().max(128),
  status: z.enum(["evidence_found", "unknown"]),
  intent: z.string().max(60),
  answer: z.string().max(8000),
  answerSource: z.enum(["model", "deterministic"]),
  factsUsed: z.array(factUsed).max(50),
  computed: computedView.nullish(),
  openConflicts: z.array(z.object({ conflictId: z.string().max(128), factKey: z.string().max(80) })).max(50).default([]),
  /** Additive backend field: "numbers_unverified" when the model wrote figures that were not checked against a fact. Unknown values are kept as text, never shown raw. */
  citations: z.array(citationView).max(20).optional(),
  sources: z.array(sourceView).max(20).optional(),
  modelStatus: z.string().max(60).optional(),
  truncated: z.boolean().optional(),
});
export const errorEvent = z.object({ code: z.string().max(60) });
export type TurnMeta = z.infer<typeof metaEvent>;
export type TurnAnswer = z.infer<typeof answerEvent>;

export type TurnEvent =
  | { type: "meta"; data: TurnMeta }
  | { type: "delta"; data: z.infer<typeof deltaEvent> }
  | { type: "answer"; data: TurnAnswer }
  | { type: "error"; data: z.infer<typeof errorEvent> }
  | { type: "done"; data: Record<string, never> };

// ---- Hospitals ----------------------------------------------------------------------------------------------------------------
// Backend route GET /api/v1/holdings/:id/hospitals?pincode= is pending (S-C2). Shape agreed: { hospitals: [{ id, name, address, city, pincode, cashless }] }.

export const hospitalView = z.object({
  id: z.string().min(1).max(128),
  name: z.string().max(200),
  address: z.string().max(400).nullish(),
  city: z.string().max(100).nullish(),
  pincode: z.string().max(10).nullish(),
  cashless: z.boolean(),
});
export type HospitalView = z.infer<typeof hospitalView>;
export const hospitalsIn = z.object({ hospitals: z.array(hospitalView).max(200), truncated: z.boolean().optional() });
export type Hospitals = z.infer<typeof hospitalsIn>;
