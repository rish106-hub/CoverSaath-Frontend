/** Premium and cover, years ahead (BUILD-SPEC 6, Money). Amounts in lakh (L) for treatment and cover, rupees for premium. */

export const START_YEAR = 2026;
export const RATES_PCT = [10, 12, 14, 16] as const;
export const DEFAULT_RATE_PCT = 12;
export const YEAR_CHOICES = [5, 10, 15, 20] as const;

export type InflationInput = {
  /** Cover in lakh. */
  coverLakh: number;
  /** Treatment cost today in lakh. */
  costTodayLakh: number;
  ratePct: number;
  years: number;
  /** Premium a year today, in rupees. */
  premiumRs: number;
  /** Yearly premium growth as a fraction, e.g. 0.07. */
  premiumGrowth: number;
  startYear?: number;
};

export type InflationPoint = { offset: number; year: number; costLakh: number; premiumRs: number; aboveCover: boolean };

export type InflationPlan = {
  points: InflationPoint[];
  costAtEndLakh: number;
  premiumAtEndRs: number;
  premiumsPaidRs: number;
  /** First year offset where the cost passes the cover, or null if it never does inside the horizon. */
  crossOffset: number | null;
  crossYear: number | null;
  /** Cover to aim for, rounded up to the next 5 lakh. */
  needLakh: number;
  outOfDate: boolean;
};

export const costAt = (todayLakh: number, ratePct: number, offset: number) => todayLakh * Math.pow(1 + ratePct / 100, offset);
export const premiumAt = (premiumRs: number, growth: number, offset: number) => premiumRs * Math.pow(1 + growth, offset);

export function planInflation(i: InflationInput): InflationPlan {
  const start = i.startYear ?? START_YEAR;
  const step = i.years <= 10 ? 1 : 2;
  const points: InflationPoint[] = [];
  for (let y = 0; y <= i.years; y += step) {
    const costLakh = costAt(i.costTodayLakh, i.ratePct, y);
    points.push({ offset: y, year: start + y, costLakh, premiumRs: premiumAt(i.premiumRs, i.premiumGrowth, y), aboveCover: costLakh > i.coverLakh });
  }
  let premiumsPaidRs = 0;
  for (let y = 0; y <= i.years; y++) premiumsPaidRs += premiumAt(i.premiumRs, i.premiumGrowth, y);
  let crossOffset: number | null = null;
  for (let y = 0; y <= 40; y++) {
    if (costAt(i.costTodayLakh, i.ratePct, y) > i.coverLakh) {
      crossOffset = y;
      break;
    }
  }
  const costAtEndLakh = costAt(i.costTodayLakh, i.ratePct, i.years);
  const outOfDate = crossOffset !== null && crossOffset <= i.years;
  return {
    points,
    costAtEndLakh,
    premiumAtEndRs: premiumAt(i.premiumRs, i.premiumGrowth, i.years),
    premiumsPaidRs,
    crossOffset: outOfDate ? crossOffset : null,
    crossYear: outOfDate && crossOffset !== null ? start + crossOffset : null,
    needLakh: Math.ceil(costAtEndLakh / 5) * 5,
    outOfDate,
  };
}

/** "Rs 6.5L", "Rs 1.2 Cr". */
export function formatLakh(l: number): string {
  return l >= 100 ? `Rs ${(l / 100).toFixed(1)} Cr` : `Rs ${Math.round(l * 10) / 10}L`;
}
export function formatRs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}
