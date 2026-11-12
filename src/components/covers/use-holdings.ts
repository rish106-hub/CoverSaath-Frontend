"use client";

import { useCallback, useEffect, useState } from "react";
import { adapters } from "@/adapters";
import { AdapterError } from "@/adapters/types";
import type { HoldingView } from "@/adapters/covers-contract";

export const codeOf = (e: unknown): string => (e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE");

/** The household's holdings, and which one the page is on. `preferred` (from the address) wins when the household has it. */
export function useHoldings(preferred?: string) {
  const [holdings, setHoldings] = useState<HoldingView[] | null>(null);
  const [picked, setPicked] = useState<string | undefined>(preferred);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await adapters.covers.holdings();
      setHoldings(list);
      setError(null);
    } catch (e) {
      setError(codeOf(e));
      setHoldings((h) => h ?? []);
    }
  }, []);

  useEffect(() => {
    let live = true;
    adapters.covers.holdings().then(
      (list) => { if (live) { setHoldings(list); setError(null); } },
      (e) => { if (live) { setError(codeOf(e)); setHoldings([]); } },
    );
    return () => { live = false; };
  }, []);

  const current = holdings?.find((h) => h.id === picked) ?? holdings?.find((h) => h.id === preferred) ?? holdings?.[holdings.length - 1];
  return { holdings, current, select: setPicked, error, reload };
}
