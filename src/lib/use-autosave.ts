"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@/components/ui/SaveState";

/**
 * Saves the newest value of a control, one request at a time. While a save is running, later values are
 * remembered and the newest one is sent next, so a quick second toggle is never dropped. The same value pushed
 * twice sends once. A failed save keeps the value; `retry` sends it again. Results after unmount are ignored.
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef<{ v: T; k: string } | null>(null);
  const inflight = useRef<string | null>(null);
  const flying = useRef(false);
  const mounted = useRef(true);
  const saver = useRef(save);
  useEffect(() => {
    saver.current = save;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const drain = useCallback(async () => {
    if (flying.current) return;
    flying.current = true;
    while (pending.current) {
      const job = pending.current;
      pending.current = null;
      inflight.current = job.k;
      if (mounted.current) setStatus("saving");
      try {
        await saver.current(job.v);
      } catch {
        pending.current = pending.current ?? job; // keep the value for Retry
        inflight.current = null;
        flying.current = false;
        if (mounted.current) setStatus("error");
        return;
      }
      inflight.current = null;
    }
    flying.current = false;
    if (mounted.current) setStatus("saved");
  }, []);

  const push = useCallback(
    (value: T) => {
      const k = JSON.stringify(value);
      if (pending.current?.k === k) return;
      if (inflight.current === k) {
        pending.current = null; // back to the value that is already being saved
        return;
      }
      pending.current = { v: value, k };
      void drain();
    },
    [drain],
  );
  const retry = useCallback(() => void drain(), [drain]);
  return { status, push, retry };
}
