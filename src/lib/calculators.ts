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

export const TOPUP_WHO = [
  { label: "Just me", rate: 180 },
  { label: "Parents (2)", rate: 950 },
  { label: "Me + family (3)", rate: 320 },
] as const;
export const TOPUP_BASE_LAKH = [3, 5, 10, 25] as const;
export const TOPUP_RISKS = [
  { label: "Heart bypass", billLakh: 12 },
  { label: "Cancer care", billLakh: 18 },
  { label: "Knee replacement", billLakh: 4.5 },
  { label: "Long ICU stay", billLakh: 9 },
] as const;
export const TOPUP_OPTIONS = [
  { logo: "KG", name: "Kaveri Super Top-up", siLakh: 10 },
  { logo: "IS", name: "Indus Shield Booster", siLakh: 20 },
  { logo: "NH", name: "Northstar Extend", siLakh: 5 },
] as const;

export type TopUpFit = "recommended" | "also-works" | "too-small";

/** Case-by-case top-up: base pays first, the top-up pays the next slice, you pay the rest. Best fit is the smallest top-up that closes the gap. */
export function topUpFinder(i: { whoIndex: number; baseLakh: number; billLakh: number; pick?: number }) {
  const gap = Math.max(i.billLakh - i.baseLakh, 0);
  const fitIndex =
    gap === 0
      ? 2
      : (TOPUP_OPTIONS.map((o, k) => ({ si: o.siLakh, k })).filter((x) => x.si >= gap).sort((a, b) => a.si - b.si)[0]?.k ?? 1);
  const pick = i.pick !== undefined && i.pick >= 0 ? i.pick : fitIndex;
  const tsi = TOPUP_OPTIONS[pick]?.siLakh ?? 0;
  const basePays = Math.min(i.billLakh, i.baseLakh);
  const topPays = Math.min(gap, tsi);
  const youNow = i.billLakh - basePays;
  const youAfter = i.billLakh - basePays - topPays;
  const rate = TOPUP_WHO[i.whoIndex]?.rate ?? 0;
  const options = TOPUP_OPTIONS.map((o, k) => {
    const covers = o.siLakh >= gap;
    const fit: TopUpFit = k === fitIndex ? "recommended" : covers ? "also-works" : "too-small";
    return { ...o, fit, covers, leftOnYouLakh: covers ? 0 : gap - o.siLakh, premiumRs: Math.round(o.siLakh * rate * (i.baseLakh >= 10 ? 0.7 : 1)) };
  });
  return { gap, fitIndex, pick, basePays, topPays, youNow, youAfter, options };
}

/** "Rs 4.5L" or whole rupees under a lakh, as on the board. */
export function formatLakhShort(l: number): string {
  if (l === 0) return "Rs 0";
  return l >= 1 ? `Rs ${Math.round(l * 10) / 10}L` : `Rs ${Math.round(l * 100000).toLocaleString("en-IN")}`;
}
