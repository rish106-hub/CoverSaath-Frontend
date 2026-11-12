"use client";

import { useCallback, useEffect, useState } from "react";
import { loadPolicies, codeOf, stateOf, type DashState, type PolicyView } from "@/adapters/real-policy";

/** The household's stored holdings with their facts, as one screen state. `reload` asks again (used while a document is being read). */
export function usePolicies(): { state: DashState; reload: () => void } {
  const [policies, setPolicies] = useState<PolicyView[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    loadPolicies().then(
      (p) => { if (live) { setPolicies(p); setCode(null); } },
      (e) => { if (live) setCode(codeOf(e)); },
    );
    return () => { live = false; };
  }, [tick]);
  const reload = useCallback(() => { setCode(null); setPolicies(null); setTick((t) => t + 1); }, []);
  return { state: stateOf(policies, code), reload };
}
