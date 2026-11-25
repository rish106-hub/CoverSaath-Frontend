/** Tools calculators (BUILD-SPEC 6, Tools). Pure functions; the board's numbers are the tests. */

export const SELF_CAP_RS = 25_000;
export const PARENTS_CAP_RS = 25_000;
export const PARENTS_SENIOR_CAP_RS = 50_000;

export type Regime = "old" | "new";

/** Section 80D. Old regime only: Rs 25,000 for self and family; Rs 25,000 for parents, Rs 50,000 if a parent is a senior citizen. */
export function section80D(i: { regime: Regime; selfRs: number; parentsRs: number; senior: boolean }) {
  const parentCap = i.senior ? PARENTS_SENIOR_CAP_RS : PARENTS_CAP_RS;
  const old = i.regime === "old";
  const self = old ? Math.min(Math.max(i.selfRs, 0), SELF_CAP_RS) : 0;
  const parents = old ? Math.min(Math.max(i.parentsRs, 0), parentCap) : 0;
  return { self, parents, total: self + parents, parentCap, available: old };
}

/** Proportionate deduction on room rent: other charges are paid in the ratio eligible room / actual room. */
export function roomRent(i: { coverRs: number; limitPct: number; roomPerDayRs: number; otherRs: number }) {
  const eligible = (i.coverRs * i.limitPct) / 100;
  const over = i.roomPerDayRs > eligible && i.roomPerDayRs > 0;
  const ratio = over ? eligible / i.roomPerDayRs : 1;
  const paidOther = i.otherRs * ratio;
  return { eligible, over, ratio, paidOther, youPayOther: i.otherRs - paidOther };
}
