import { z } from "zod";

// Wire contract of the evidence routes under /api/app (policy profile, questions, decision catalogue, coverage preview, source
// pack, deletion inventory, integrations). Shared by the BFF routes (input allow-lists) and the browser adapter.
// Answers, handoffs and previews are backend bodies passed through unchanged: deterministic code on the backend owns every
// decision in them, and the page must treat each as unverified until it says otherwise.
// Legal review: the question-consent wording is DRAFT and not final.

export const PATH_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const id = z.string().min(1).max(128).regex(PATH_ID);

/** One Idempotency-Key per user action. A repeat after a timeout is then the same statement, not a second one. */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,200}$/;

export type PassThrough = Record<string, unknown>;

/** Owner's statement of what a document is. Every field is optional; the backend decides what is acceptable. */
export const confirmPolicyProfileIn = z
  .object({
    uin: z.string().trim().min(1).max(40).optional(),
    insurerCode: z.string().trim().min(1).max(10).optional(),
    insurerName: z.string().trim().min(1).max(200).optional(),
    policyName: z.string().trim().min(1).max(200).optional(),
    expectedVersion: z.number().int().min(0).max(1_000_000),
  })
  .strict();
export type ConfirmPolicyProfile = z.infer<typeof confirmPolicyProfileIn>;

export const askQuestionIn = z
  .object({ question: z.string().trim().min(1).max(2000), documentIds: z.array(id).min(1).max(10).optional() })
  .strict();
export type AskQuestion = z.infer<typeof askQuestionIn>;

export const catalogueReviewIn = z
  .object({
    answerId: z.string().min(1).max(128),
    factId: z.string().min(1).max(128),
    decision: z.string().min(1).max(20),
    reasonCode: z.string().min(1).max(40),
    attestedSourceType: z.string().max(60).nullable().optional(),
    attestsPolicyAssociation: z.boolean().optional(),
    asOf: z.string().max(40).nullable().optional(),
    memberId: z.string().max(128).nullable().optional(),
  })
  .strict();
export type CatalogueReview = z.infer<typeof catalogueReviewIn>;

export const handoffQueryIn = z.object({
  answerId: z.string().max(128).nullable(),
  asOf: z.string().max(40).nullable(),
  memberId: z.string().max(128).nullable(),
});
export type HandoffQuery = { answerId?: string; asOf?: string; memberId?: string };

export const designateConfirmerIn = z.object({ adultUserId: z.string().min(1).max(128) }).strict();

export const coveragePreviewIn = z
  .object({
    contractVersion: z.literal("household-scenario/v1"),
    sources: z.array(z.object({ caseId: id, answerId: id }).strict()).min(1).max(5),
    scenario: z.record(z.string(), z.unknown()),
  })
  .strict();
export type CoveragePreview = z.infer<typeof coveragePreviewIn>;

/** What every evidence route answers: `{ ok: true, data }`. `data` is the backend body. */
export const evidenceOut = z.object({ ok: z.literal(true).optional(), data: z.unknown() });
