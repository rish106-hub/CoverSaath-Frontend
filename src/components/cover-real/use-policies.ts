"use client";

import { useCallback, useEffect, useState } from "react";
import { loadPolicy, codeOf, stateOf, MAX_HOLDINGS, type DashState, type PolicyView } from "@/adapters/real-policy";
import { backendCovers } from "@/adapters/covers";
import type { CreationIssue } from "@/adapters/covers-contract";

/**
 * The household's stored holdings with their facts, as one screen state, plus the documents the backend could not make a holding
 * from (`issues`). `reload` asks again (used while a document is being read).
 */
export function usePolicies(): { state: DashState; issues: CreationIssue[]; reload: () => void } {
  const [policies, setPolicies] = useState<PolicyView[] | null>(null);
  const [issues, setIssues] = useState<CreationIssue[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    backendCovers.holdingsView().then(
      async (v) => {
        const p = await Promise.all(v.holdings.slice(0, MAX_HOLDINGS).map(loadPolicy));
        if (live) { setPolicies(p); setIssues(v.creationIssues); setCode(null); }
      },
      (e) => { if (live) setCode(codeOf(e)); },
    );
    return () => { live = false; };
  }, [tick]);
  const reload = useCallback(() => { setCode(null); setPolicies(null); setTick((t) => t + 1); }, []);
  return { state: stateOf(policies, code), issues, reload };
}
