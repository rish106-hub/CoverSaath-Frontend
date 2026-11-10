"use client";

import { useEffect, useState } from "react";
import { adapters, AdapterError } from "@/adapters";
import type { ReferenceProduct, ReferenceQuery } from "@/adapters/reference-contract";

export type ReferenceState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "error"; retryable: boolean }
  | { status: "data"; products: ReferenceProduct[]; ambiguous: boolean };

/** Looks up public product reference for one key. The query must be memoised or primitive-keyed by the caller (see `key`). */
export function useReferenceProducts(query: ReferenceQuery | null): ReferenceState {
  const key = query ? JSON.stringify(query) : "";
  const [done, setDone] = useState<{ key: string; state: ReferenceState } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    const finish = (state: ReferenceState) => live && setDone({ key, state });
    adapters.reference
      .products(JSON.parse(key) as ReferenceQuery)
      .then((r) => finish(r.products.length ? { status: "data", products: r.products, ambiguous: r.ambiguous } : { status: "empty" }))
      .catch((e: unknown) => {
        if (e instanceof AdapterError && e.code === "REFERENCE_UNAVAILABLE") finish({ status: "unavailable" });
        else finish({ status: "error", retryable: e instanceof AdapterError && e.retryable });
      });
    return () => {
      live = false;
    };
  }, [key]);
  if (!key) return { status: "empty" };
  return done?.key === key ? done.state : { status: "loading" };
}
