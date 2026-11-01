/** Pure state logic for "Things to check" (board Audit). */

export type ReviewState = {
  /** decision index -> chosen option index (absent = still open) */
  dec: Record<number, number>;
  ok: Record<number, boolean>;
  ch: Record<number, boolean>;
};

export const emptyReview: ReviewState = { dec: {}, ok: {}, ch: {} };

export function summarize(s: ReviewState, total: number, nDecisions: number, nLooks: number) {
  const decided = Object.keys(s.dec).length;
  const reviewed = Object.values(s.ok).filter(Boolean).length;
  const left = nDecisions - decided + (nLooks - reviewed);
  const done = total - left;
  const next = nextLook(s, nLooks);
  return {
    left,
    done,
    pct: Math.round((done / total) * 100),
    open: nDecisions - decided,
    next,
    headline: left ? `${left} ${left === 1 ? "thing needs" : "things need"} you. Knowvia handled the rest.` : "All set. Ready to continue.",
  };
}

/** First look item that is neither ticked nor flagged: the one A and C act on. -1 when none. */
export function nextLook(s: ReviewState, nLooks: number): number {
  for (let i = 0; i < nLooks; i++) if (!s.ok[i] && !s.ch[i]) return i;
  return -1;
}

export function accept(s: ReviewState, i: number): ReviewState {
  return { ...s, dec: { ...s.dec, [i]: s.dec[i] ?? 0 } };
}
export function pick(s: ReviewState, i: number, option: number): ReviewState {
  return { ...s, dec: { ...s.dec, [i]: option } };
}
export function acceptAll(s: ReviewState, nDecisions: number): ReviewState {
  const dec = { ...s.dec };
  for (let i = 0; i < nDecisions; i++) if (dec[i] === undefined) dec[i] = 0;
  return { ...s, dec };
}
export function tick(s: ReviewState, i: number): ReviewState {
  return { ...s, ok: { ...s.ok, [i]: !s.ok[i] }, ch: { ...s.ch, [i]: false } };
}
export function flag(s: ReviewState, i: number): ReviewState {
  return { ...s, ch: { ...s.ch, [i]: true }, ok: { ...s.ok, [i]: false } };
}
