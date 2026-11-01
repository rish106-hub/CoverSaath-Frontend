// Plan comparison maths, ported from design/Compare.dc.html. All plans and figures are invented.

export type Dot = "good" | "okay" | "watch";
export type Kind = "top" | "base";
export type Band = 5 | 10 | 25;
export const BANDS: Band[] = [5, 10, 25];

export type PlanCard = { logo: string; name: string; plan: string; price: string; per: string; si: number; nf: number; room: number };
export type Row = { icon: string; title: string; hint: string; cells: string[]; dots: Dot[]; priority: number };
export type Priority = { id: number; icon: string; title: string; why: string };

export const WEIGHT_LABELS = ["Off", "Low", "Medium", "High"] as const;
export const DEFAULT_WEIGHTS: Record<number, number> = { 0: 3, 1: 2, 2: 0, 3: 1, 4: 2, 5: 1 };

export const PRIORITIES: Priority[] = [
  { id: 0, icon: "₹", title: "No surprise bills", why: "Father’s claim was cut" },
  { id: 1, icon: "▣", title: "Any room", why: "Your room limit is 1%" },
  { id: 2, icon: "%", title: "No co-pay", why: "Parents pay 20% today" },
  { id: 3, icon: "⏳", title: "Short waits", why: "Knee surgery is planned" },
  { id: 4, icon: "✚", title: "Hospitals nearby", why: "Kothrud and Wanowrie" },
  { id: 5, icon: "✓", title: "Claims paid on time", why: "One claim took 34 days" },
];

export const SCENARIOS = [
  { name: "Bypass", billL: 6.5 },
  { name: "Knee", billL: 3.8 },
  { name: "Cancer", billL: 14 },
  { name: "Dengue", billL: 0.85 },
] as const;

export function plans(kind: Kind, band: Band): PlanCard[] {
  const top = kind === "top";
  return [
    { logo: "NH", name: "Your cover today", plan: "Northstar group, Rs 5L", price: "Rs 0", per: "employer pays", si: 0, nf: 0.06, room: 0.08 },
    { logo: "KG", name: "Kaveri General", plan: top ? `Super Top-up Rs ${band}L` : `Family Shield Rs ${band}L`, price: top ? "Rs 7,900" : "Rs 24,600", per: "/ year", si: band, nf: 0.03, room: 0 },
    { logo: "MC", name: "Meridian Care", plan: top ? `Extra Care Rs ${band}L` : `Optima Family Rs ${band}L`, price: top ? "Rs 6,400" : "Rs 21,900", per: "/ year", si: band, nf: 0.05, room: 0.02 },
    { logo: "IS", name: "Indus Shield Health", plan: top ? `Plus Top-up Rs ${band}L` : `Complete Rs ${band}L`, price: top ? "Rs 9,200" : "Rs 27,300", per: "/ year", si: band, nf: 0.02, room: 0 },
  ];
}

const G: Dot = "good";
const Y: Dot = "okay";
const R: Dot = "watch";
export { R as WATCH };

/** priority 0 means the row always counts with weight 1. */
export function rows(band: Band): Row[] {
  return [
    { icon: "◎", title: "Cover", hint: "How much it pays in a year", cells: ["Rs 5L shared", `Rs ${band}L after Rs 5L`, `Rs ${band}L after Rs 5L`, `Rs ${band}L after Rs 3L`], dots: [Y, G, G, G], priority: 0 },
    { icon: "▣", title: "Room rent", hint: "Limit on the room per day", cells: ["1% of cover", "Any room", "Single private room", "Any room"], dots: [Y, G, G, G], priority: 1 },
    { icon: "%", title: "Co-pay", hint: "Your share of every bill", cells: ["None", "None", "10% above age 60", "None"], dots: [G, G, Y, G], priority: 2 },
    { icon: "⏳", title: "Old illnesses", hint: "Wait before they are covered", cells: ["Day one", "3 years", "2 years", "1 year"], dots: [G, Y, Y, G], priority: 3 },
    { icon: "↻", title: "Refill", hint: "Cover refills after it runs out", cells: ["Once a year", "Unlimited", "Once a year", "Unlimited"], dots: [Y, G, Y, G], priority: 0 },
    { icon: "✂", title: "Caps on treatments", hint: "Limits on named surgeries", cells: ["Cataract Rs 40k", "None", "Cataract Rs 50k", "None"], dots: [Y, G, Y, G], priority: 0 },
    { icon: "✓", title: "Claims paid", hint: "Share of claims paid last year", cells: ["94%", "97%", "95%", "96%"], dots: [Y, G, Y, G], priority: 5 },
    { icon: "✚", title: "Cashless in Pune", hint: "Hospitals near you", cells: ["212", "248", "196", "231"], dots: [G, G, Y, G], priority: 4 },
  ];
}

const DOT_VALUE: Record<Dot, number> = { good: 1, okay: 0.5, watch: 0 };

/** Fit % per plan: weighted share of good (1) / okay (0.5) / watch (0) across rows. */
export function fitScores(rowList: Row[], weights: Record<number, number>, planCount = 4): number[] {
  return Array.from({ length: planCount }, (_, i) => {
    let n = 0;
    let d = 0;
    for (const r of rowList) {
      const w = r.priority === 0 ? 1 : weights[r.priority] || 0;
      n += w * DOT_VALUE[r.dots[i]];
      d += w;
    }
    return d ? Math.round((n / d) * 100) : 0;
  });
}

/** Index of the best new plan (the first plan, today's cover, is never the pick). */
export function bestIndex(scores: number[]): number {
  return scores.indexOf(Math.max(...scores.slice(1)));
}

export function cycleWeight(w: number): number {
  return (w + 1) % 4;
}

/** What the family pays, in lakh, for a bill of `billL` lakh. */
export function youPaysL(p: PlanCard, i: number, billL: number, kind: Kind): number {
  const extras = billL * p.nf + Math.min(billL, 5) * p.room;
  if (i === 0) return Math.max(billL - 5, 0) + extras;
  return (kind === "top" ? Math.max(billL - 5 - p.si, 0) : Math.max(billL - p.si, 0)) + extras;
}

export function lakh(l: number): string {
  return l <= 0 ? "Rs 0" : l >= 1 ? "Rs " + Math.round(l * 10) / 10 + "L" : "Rs " + Math.round(l * 100000).toLocaleString("en-IN");
}

export function planPrefix(plan: string): string {
  return plan.replace(/ Rs.*/, "");
}

export function verdictText(sel: number, list: PlanCard[], scores: number[], scen: number, kind: Kind): string {
  if (sel === 0) return `Your current cover scores ${scores[0]}%. The gaps are the shared Rs 5L and the room limit.`;
  const bill = SCENARIOS[scen].billL;
  return `Keep your group plan and add ${list[sel].name} ${planPrefix(list[sel].plan)}. On a ${SCENARIOS[scen].name.toLowerCase()} bill you pay ${lakh(youPaysL(list[sel], sel, bill, kind))} instead of ${lakh(youPaysL(list[0], 0, bill, kind))}.`;
}
