"use client";

import { useEffect, useState } from "react";
import type { Stat } from "@/data/mock/home";

export function formatStat(s: Stat, v: number = s.value): string {
  const n = s.decimals ? v.toFixed(s.decimals) : s.group ? Math.round(v).toLocaleString("en-IN") : String(Math.round(v));
  return `${s.prefix ?? ""}${n}${s.suffix ?? ""}`;
}

/** Number that counts up once on mount (420 ms, ease-out). Renders the final value on the server and with reduced motion. */
export function CountUp({ stat }: { stat: Stat }) {
  const [v, setV] = useState(stat.value);
  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 420);
      setV(stat.value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stat]);
  return <>{formatStat(stat, v)}</>;
}
