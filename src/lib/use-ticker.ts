"use client";

import { useEffect, useRef } from "react";

/** setInterval that pauses while the tab is hidden and always cleans up. Pass `enabled=false` for reduced motion. */
export function useTicker(cb: () => void, ms: number, enabled = true) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  useEffect(() => {
    if (!enabled) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null && !document.hidden) id = setInterval(() => ref.current(), ms);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}
