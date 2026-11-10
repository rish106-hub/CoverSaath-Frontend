import type { ReferenceAdapter } from "../types";
import type { ReferenceProduct } from "../reference-contract";
import { delay } from "./delay";

// Synthetic product reference for the demo session. Fictional insurer and plan; the shape matches the backend response.
const FETCHED = "2026-01-01T00:00:00.000Z";
const PRODUCTS: ReferenceProduct[] = [
  {
    productId: "prod_example_01", insurerId: "ins_example_1", productName: "Example Health Plan 01", lineOfBusiness: "health",
    uinRaw: "SYNTHETIC-TEST-ONLY/01", verificationStatus: "synthetic_test", dataCoverage: "not_observed", lastObservedAt: FETCHED,
  },
];

export const mockReference: ReferenceAdapter = {
  products: (query) => {
    const hit = (p: ReferenceProduct) => {
      if ("q" in query) return p.productName.toLowerCase().includes(query.q.toLowerCase());
      if ("uin" in query) return p.uinRaw?.toLowerCase() === query.uin.toLowerCase();
      return p.insurerId === query.insurerId;
    };
    const products = PRODUCTS.filter(hit);
    return delay({ products, ambiguous: products.length > 1, fetchedAt: FETCHED });
  },
};
