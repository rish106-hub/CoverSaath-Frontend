import { z } from "zod";

// Contract for the public product reference lookup (backend GET /api/v1/reference/products). Shared by the BFF and the browser
// adapter. Reference data is context only: it never feeds eligibility, money, consent or release, and carries no household data.

const noControl = (v: string) => !/[\u0000-\u001f\u007f]/.test(v);
const term = z.string().trim().min(1).max(100).refine(noControl);

/** Exactly one lookup key, as the backend allows. */
export const referenceQuery = z.union([
  z.object({ q: term }).strict(),
  z.object({ uin: term }).strict(),
  z.object({ insurerId: z.string().regex(/^[A-Za-z0-9_.:-]{1,100}$/) }).strict(),
]);
export type ReferenceQuery = z.infer<typeof referenceQuery>;

const VERIFICATION = ["synthetic_test", "source_observed", "candidate", "independently_verified"] as const;

export const referenceProduct = z.object({
  productId: z.string().min(1).max(100),
  insurerId: z.string().min(1).max(100),
  productName: z.string().min(1).max(300),
  lineOfBusiness: z.string().max(100),
  uinRaw: z.string().max(100).nullable(),
  verificationStatus: z.enum(VERIFICATION),
  dataCoverage: z.string().max(100).nullish(),
  lastObservedAt: z.string().max(40).nullish(),
});
export type ReferenceProduct = z.infer<typeof referenceProduct>;

/** What the backend sends. Unknown fields are dropped. */
export const referenceProductsIn = z.object({
  products: z.array(referenceProduct).max(50),
  ambiguous: z.boolean(),
  source: z.enum(["cache", "service"]),
  fetchedAt: z.string().max(40),
  referenceContextOnly: z.literal(true),
});

/** What the BFF sends to the browser. */
export const referenceProductsOut = z.object({ ok: z.literal(true).optional(), products: referenceProductsIn.shape.products, ambiguous: z.boolean(), fetchedAt: z.string() });
export type ReferenceProducts = { products: ReferenceProduct[]; ambiguous: boolean; fetchedAt: string };

/** Query string for the BFF, from a validated query. */
export function referenceSearch(query: ReferenceQuery): string {
  return new URLSearchParams(query as Record<string, string>).toString();
}
