"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs async work one at a time. A ref (not state) blocks re-entry, so 20 clicks in the same tick
 * start one request. `alive()` tells the caller whether the component is still mounted, so results
 * after unmount are dropped instead of setting state.
 */
export function useSingleFlight() {
  const flying = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const alive = useCallback(() => mounted.current, []);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (flying.current) return undefined;
    flying.current = true;
    if (mounted.current) setBusy(true);
    try {
      return await fn();
    } finally {
      flying.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);
  return { run, busy, alive };
}
