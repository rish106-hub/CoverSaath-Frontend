"use client";

import { useCallback, useEffect, useState } from "react";
import { backendCovers } from "@/adapters/covers";
import { codeOf, MAX_HOLDINGS, stageOf } from "@/adapters/real-policy";
import type { FactView, HoldingView } from "@/adapters/covers-contract";

export type RealCover = { holding: HoldingView; facts: FactView[] };
export type RealCoversState = { kind: "loading" } | { kind: "error"; code: string } | { kind: "ready"; covers: RealCover[] };

/** The household's read holdings with their raw facts (for screens that compute from numbers). A holding whose facts fail loads with none. */
export function useRealCovers(): { state: RealCoversState; reload: () => void } {
  const [state, setState] = useState<RealCoversState>({ kind: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    backendCovers.holdings().then(
      async (hs) => {
        const covers = await Promise.all(
          hs.slice(0, MAX_HOLDINGS).filter((h) => stageOf(h.status) === "ready" || stageOf(h.status) === "needs_review").map(async (holding) => ({ holding, facts: await backendCovers.facts(holding.id).then((f) => f.facts, () => []) })),
        );
        if (live) setState({ kind: "ready", covers });
      },
      (e) => { if (live) setState({ kind: "error", code: codeOf(e) }); },
    );
    return () => { live = false; };
  }, [tick]);
  const reload = useCallback(() => { setState({ kind: "loading" }); setTick((t) => t + 1); }, []);
  return { state, reload };
}
