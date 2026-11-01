import type { CSSProperties } from "react";

/** Largest stagger index, so a long list never waits more than about 0.4 s to finish appearing. */
export const STAGGER_CAP = 8;

/**
 * Style for the i-th child of a `.k-stagger` parent (or any `.k-reveal` element).
 * Reduced motion and low-capacity mode are handled in CSS (globals.css), so this stays pure.
 */
export function stagger(i: number): CSSProperties {
  const n = Number.isFinite(i) ? Math.min(Math.max(Math.trunc(i), 0), STAGGER_CAP) : 0;
  return { "--i": n } as CSSProperties;
}
