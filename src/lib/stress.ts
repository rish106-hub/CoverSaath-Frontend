// Stress-test maths, ported from design/Policy.dc.html calc(who, sc, o). All figures are invented.

export const PEOPLE = [
  { name: "Meera", ini: "M", role: "You" },
  { name: "Rohan", ini: "R", role: "Spouse" },
  { name: "Kabir", ini: "K", role: "Son" },
  { name: "Mother", ini: "Ma", role: "Parent" },
  { name: "Father", ini: "Pa", role: "Parent" },
] as const;
export type Person = (typeof PEOPLE)[number]["name"];

export const SCENARIOS = {
  dengue: { icon: "🦟", title: "Dengue, 3 nights", bill: 85000 },
  knee: { icon: "🦵", title: "Knee replacement", bill: 380000 },
  heart: { icon: "❤", title: "Heart bypass", bill: 650000 },
  cat: { icon: "👁", title: "Cataract, one eye", bill: 55000 },
  birth: { icon: "👶", title: "Childbirth", bill: 140000 },
  icu: { icon: "＋", title: "ICU, 5 days", bill: 520000 },
} as const;
export type Scenario = keyof typeof SCENARIOS;
export const SCENARIO_KEYS = Object.keys(SCENARIOS) as Scenario[];

export type Levers = { top: boolean; net: boolean; room: boolean };
export const NO_LEVERS: Levers = { top: false, net: false, room: false };

export type StressResult = {
  bill: number;
  nonPay: number;
  roomCut: number;
  sub: number;
  coAmt: number;
  ins: number;
  topPays: number;
  you: number;
  parent: boolean;
  cover: number;
};

export function isParent(who: Person): boolean {
  return who === "Father" || who === "Mother";
}

export function calc(who: Person, sc: Scenario, o: Levers): StressResult {
  const bill = SCENARIOS[sc].bill;
  const parent = isParent(who);
  const cover = parent ? 300000 : 500000;
  const sub = parent && sc === "knee" ? 200000 : parent && sc === "cat" ? 40000 : Infinity;
  const copay = parent ? 0.2 : 0;
  const nonPay = Math.round(bill * (o.net ? 0.035 : 0.06));
  const roomCut = o.room ? 0 : Math.round(Math.min(bill - nonPay, cover) * (parent ? 0.1 : 0.06));
  const eligible = Math.min(bill - nonPay - roomCut, sub);
  const coAmt = eligible * copay;
  const ins = Math.min(eligible - coAmt, cover);
  // Top-up rule: Meera already has the Kaveri top-up. Others get it only with the lever on.
  const hasTop = o.top || who === "Meera";
  const topPays = !hasTop
    ? 0
    : parent
      ? Math.max(0, bill - nonPay - ins)
      : Math.max(0, Math.min(1000000, bill - nonPay - Math.max(ins, 500000)));
  const you = Math.max(0, bill - ins - topPays);
  return { bill, nonPay, roomCut, sub, coAmt, ins, topPays, you, parent, cover };
}

/** How much a lever would save right now (0 when already on). */
export function leverSaving(who: Person, sc: Scenario, o: Levers, k: keyof Levers): number {
  if (o[k]) return 0;
  const now = calc(who, sc, o).you;
  return Math.max(0, now - calc(who, sc, { ...o, [k]: true }).you);
}

export function inr(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}
export function rs(n: number): string {
  return "Rs " + inr(n);
}
export function shortBill(b: number): string {
  return "Rs " + (b >= 100000 ? (b / 100000).toFixed(1).replace(".0", "") + "L" : inr(b));
}

export function verdict(you: number): { label: "Manageable" | "Heavy" | "Big gap"; tone: "good" | "warn" | "bad" } {
  if (you < 20000) return { label: "Manageable", tone: "good" };
  if (you < 100000) return { label: "Heavy", tone: "warn" };
  return { label: "Big gap", tone: "bad" };
}

export function youNote(r: StressResult): string {
  if (r.you < 10000) return "Mostly items no policy pays: gloves, admission kit, registration.";
  if (r.parent) return "Most of it is the 20% co-pay" + (r.sub < Infinity ? " and the cap on this treatment." : ".");
  if (r.bill > r.cover && !r.topPays) return "Above the shared Rs 5L group cover.";
  return "Mostly the room limit and items no plan pays.";
}

export type Step = { icon: string; title: string; ref: string; x: number; w: number; tone: "bill" | "cut" | "pay" | "top"; value: string; zero: boolean };

/** The seven rows of "The bill, step by step". Percent widths are of the bill. */
export function waterfall(who: Person, r: StressResult, o: Levers): Step[] {
  const pc = (n: number) => Math.max(0, Math.round((n / r.bill) * 100));
  let x = 0;
  const seg = (amt: number) => {
    const w = pc(amt);
    const st = x;
    x += w;
    return { x: st, w };
  };
  const nonS = seg(r.nonPay);
  const roomS = seg(r.roomCut);
  const subCut = r.sub < Infinity ? Math.max(0, r.bill - r.nonPay - r.roomCut - r.sub) : 0;
  const subS = seg(subCut);
  const coS = seg(r.coAmt);
  return [
    { icon: "₹", title: "Hospital bill", ref: "typical, Pune", x: 0, w: 100, tone: "bill", value: rs(r.bill), zero: false },
    { icon: "✕", title: "Items no plan pays", ref: "Annex II", ...nonS, tone: "cut", value: "− " + rs(r.nonPay), zero: false },
    { icon: "▣", title: "Room above the limit", ref: o.room ? "room within limit" : "p.12 room rent", ...roomS, tone: "cut", value: o.room ? "Rs 0" : "− " + rs(r.roomCut), zero: !!o.room },
    { icon: "✂", title: "Cap on this treatment", ref: r.sub < Infinity ? "p.14 §5.2" : "none on this plan", ...subS, tone: "cut", value: subCut ? "− " + rs(subCut) : "Rs 0", zero: !subCut },
    { icon: "%", title: "Your co-pay", ref: r.parent ? "20% · p.2" : "none", ...coS, tone: "cut", value: r.coAmt ? "− " + rs(r.coAmt) : "Rs 0", zero: !r.coAmt },
    { icon: "✓", title: "Insurer pays", ref: r.parent ? "Meridian senior plan" : "Northstar group", x: 0, w: pc(r.ins), tone: "pay", value: rs(r.ins), zero: false },
    { icon: "↗", title: "Top-up pays", ref: r.topPays ? "Kaveri, after Rs 5L" : "no top-up for " + who, x: pc(r.ins), w: pc(r.topPays), tone: "top", value: rs(r.topPays), zero: !r.topPays },
  ];
}

export type Quality = "Strong" | "Okay" | "Weak" | "None";
export type SectionBar = { title: string; pct: number; rating: Quality };

export function sectionBars(parent: boolean): SectionBar[] {
  const rows: [string, number, Quality][] = parent
    ? [["Room rent", 40, "Weak"], ["Co-pay", 30, "Weak"], ["Old illnesses", 55, "Okay"], ["Waiting periods", 50, "Okay"], ["Caps on treatments", 35, "Weak"], ["Day-care procedures", 85, "Strong"], ["Refill", 0, "None"], ["Hospitals nearby", 80, "Strong"]]
    : [["Room rent", 70, "Okay"], ["Co-pay", 100, "Strong"], ["Old illnesses", 100, "Strong"], ["Waiting periods", 100, "Strong"], ["Caps on treatments", 80, "Strong"], ["Maternity", 75, "Strong"], ["Refill", 60, "Okay"], ["Cover size", 45, "Okay"]];
  return rows.map(([title, pct, rating]) => ({ title, pct, rating }));
}

export function policyFor(parent: boolean) {
  return parent ? { logo: "MC", name: "Meridian Care · senior plan", score: "5.8", good: false } : { logo: "NH", name: "Northstar Health · group", score: "7.9", good: true };
}

export function prosCons(parent: boolean) {
  return parent
    ? { pros: ["Day-care procedures covered in full", "Most Pune hospitals are cashless", "Diabetes covered after 1 year"], cons: ["20% co-pay on every claim", "Room limited to Rs 3,000 a day", "Caps on knee and cataract"] }
    : { pros: ["No waiting periods on the group plan", "Old illnesses covered from day one", "Maternity and newborn included"], cons: ["Rs 5L is shared by three people", "Ends when you leave the job", "Room limit of 1% of cover"] };
}

export function familyRow(p: Person, sc: Scenario, o: Levers) {
  const fr = calc(p, sc, o);
  const ip = Math.round(((fr.bill - fr.you) / fr.bill) * 100);
  return {
    you: fr.you,
    insPct: ip,
    youPct: 100 - ip,
    why: fr.parent ? "20% co-pay, Rs 3L cover" : p === "Meera" ? "Top-up covers the gap" : "Shares Rs 5L, no top-up",
  };
}
