"use client";

import type { ReferenceQuery } from "@/adapters/reference-contract";
import { useReferenceProducts } from "./useReferenceProducts";
import s from "./ProductReference.module.css";

/**
 * Quiet list of public product reference rows. Not mounted anywhere yet: it belongs beside a policy's product name
 * (policy detail) once a policy carries a UIN. Context only; it never changes a decision.
 */
export function ProductReference({ query }: { query: ReferenceQuery | null }) {
  const state = useReferenceProducts(query);
  if (state.status === "loading") return <p className={s.note} role="status" aria-live="polite">Looking up product details</p>;
  if (state.status === "unavailable") return <p className={s.note}>Product details are not available right now.</p>;
  if (state.status === "error") return <p className={s.note} role="alert">{state.retryable ? "Could not look that up. Try again shortly." : "Could not look that up."}</p>;
  if (state.status === "empty") return <p className={s.note}>No matching product found.</p>;
  return (
    <ul className={s.list}>
      {state.products.map((p) => (
        <li key={p.productId} className={s.row}>
          <span className={s.name}>{p.productName}</span>
          <span className={s.meta}>{[p.lineOfBusiness, p.uinRaw].filter(Boolean).join(" · ")}</span>
        </li>
      ))}
    </ul>
  );
}
