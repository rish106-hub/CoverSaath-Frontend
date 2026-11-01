import type { Regime } from "@/lib/calculators";
import { RATES_PCT, YEAR_CHOICES } from "@/lib/inflation";
import { PEOPLE, SCENARIO_KEYS, type Levers, type Person, type Scenario } from "@/lib/stress";
import type { Kind } from "@/lib/fit";
import type { ReviewState } from "@/components/cover/review-logic";

// Maps what the screens hold in state to the backend scenario contract (src/contracts/user-data.js) and back. Every encoder returns
// only fields the contract accepts, clamped to its bounds; every decoder ignores values it does not recognise, so a bad stored
// value falls back to the screen's default instead of breaking it. Fields the contract has no place for are not sent (see
// docs/persistence-matrix.md).

export type Codec<T> = { encode(v: T): Record<string, unknown>; decode(inputs: Record<string, unknown>): Partial<T> };

const clampInt = (n: number, max: number) => Math.min(max, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const oneOf = <T extends string | number>(v: unknown, list: readonly T[]): T | undefined => list.find((x) => x === v);

// ---- Tools: 80D ------------------------------------------------------------------------------------------------------------
export type TaxState = { regime: Regime; self: number; par: number; senior: boolean };
export const taxCodec: Codec<TaxState> = {
  encode: (s) => ({ regime: s.regime, ageBand: s.senior ? "60to80" : "under60", premiumsPaid: clampInt(s.self, 1e7), deduction80d: clampInt(s.par, 1e6) }),
  decode: (i) => {
    const out: Partial<TaxState> = {};
    const regime = oneOf(i.regime, ["old", "new"] as const);
    if (regime) out.regime = regime;
    const band = oneOf(i.ageBand, ["under60", "60to80", "above80"] as const);
    if (band) out.senior = band !== "under60";
    const self = num(i.premiumsPaid);
    if (self !== undefined) out.self = self;
    const par = num(i.deduction80d);
    if (par !== undefined) out.par = par;
    return out;
  },
};

// ---- Tools: room rent ------------------------------------------------------------------------------------------------------
export type RoomState = { cover: number; pct: number; room: number; other: number };
export const roomCodec: Codec<RoomState> = {
  encode: (s) => ({
    sumInsured: clampInt(s.cover, 1e9), roomRentCap: clampInt((s.cover * s.pct) / 100, 1e6), roomRentActual: clampInt(s.room, 1e6), billAmount: clampInt(s.other, 1e8),
  }),
  decode: (i) => {
    const out: Partial<RoomState> = {};
    const cover = num(i.sumInsured);
    if (cover !== undefined) out.cover = cover;
    const cap = num(i.roomRentCap);
    if (cap !== undefined && cover) out.pct = Math.round((cap / cover) * 10_000) / 100;
    const room = num(i.roomRentActual);
    if (room !== undefined) out.room = room;
    const other = num(i.billAmount);
    if (other !== undefined) out.other = other;
    return out;
  },
};

// ---- Money: inflation planner ----------------------------------------------------------------------------------------------
export type InflationState = { who: number; kase: number; rate: number; years: number };
const CASE_KINDS = ["cardiac", "cancer", "orthopaedic", "hospitalisation"] as const; // planCases order
export const inflationCodec: Codec<InflationState> = {
  encode: (s) => ({ who: `who-${s.who}`, caseKind: CASE_KINDS[s.kase] ?? "hospitalisation", medicalInflationPct: s.rate, years: s.years }),
  decode: (i) => {
    const out: Partial<InflationState> = {};
    const who = typeof i.who === "string" ? /^who-(\d{1,2})$/.exec(i.who) : null;
    if (who) out.who = Number(who[1]);
    const k = CASE_KINDS.findIndex((c) => c === i.caseKind);
    if (k >= 0) out.kase = k;
    const rate = oneOf(i.medicalInflationPct, RATES_PCT);
    if (rate !== undefined) out.rate = rate;
    const years = oneOf(i.years, YEAR_CHOICES);
    if (years !== undefined) out.years = years;
    return out;
  },
};

// ---- Compare ---------------------------------------------------------------------------------------------------------------
export type CompareState = { kind: Kind; scen: number; weights: Record<number, number> };
const WEIGHT_NAMES = ["price", "coverage", "restoration", "waitingPeriods", "network", "claims"] as const; // priority ids 0..5
const WEIGHT_STEP = [0, 34, 67, 100]; // Off, Low, Medium, High
const COMPARE_SCEN = ["emergency", "planned_surgery", "critical_illness", "routine"] as const; // Bypass, Knee, Cancer, Dengue
export const compareCodec: Codec<CompareState> = {
  encode: (s) => ({
    kind: s.kind === "top" ? "top_up" : "family_floater",
    scenario: COMPARE_SCEN[s.scen] ?? "routine",
    weights: Object.fromEntries(WEIGHT_NAMES.map((n, id) => [n, WEIGHT_STEP[Math.min(3, Math.max(0, s.weights[id] ?? 0))]])),
  }),
  decode: (i) => {
    const out: Partial<CompareState> = {};
    if (i.kind === "top_up") out.kind = "top";
    else if (i.kind === "family_floater" || i.kind === "individual" || i.kind === "group") out.kind = "base";
    const sc = COMPARE_SCEN.findIndex((c) => c === i.scenario);
    if (sc >= 0) out.scen = sc;
    if (i.weights && typeof i.weights === "object") {
      const w: Record<number, number> = {};
      WEIGHT_NAMES.forEach((n, id) => {
        const v = num((i.weights as Record<string, unknown>)[n]);
        if (v !== undefined) w[id] = Math.min(3, Math.max(0, Math.round((v / 100) * 3)));
      });
      if (Object.keys(w).length) out.weights = w;
    }
    return out;
  },
};

// ---- Stress test -----------------------------------------------------------------------------------------------------------
export type StressState = { who: Person; sc: Scenario; levers: Levers };
// Six screen scenarios, five contract values: "dengue" has none and is not stored.
const STRESS_SCEN: Partial<Record<Scenario, string>> = { knee: "major_surgery", heart: "critical_illness", cat: "accident", birth: "maternity", icu: "long_stay" };
export const stressCodec: Codec<StressState> = {
  encode: (s) => {
    const out: Record<string, unknown> = {
      who: s.who,
      // No dedicated fields yet: add-a-top-up raises the sum insured, cashless removes the claim delay, a room within the limit is "no upgrade".
      levers: { sumInsuredPct: s.levers.top ? 200 : 100, claimDelayDays: s.levers.net ? 0 : 14, roomUpgrade: !s.levers.room },
    };
    const sc = STRESS_SCEN[s.sc];
    if (sc) out.scenario = sc;
    return out;
  },
  decode: (i) => {
    const out: Partial<StressState> = {};
    const who = PEOPLE.find((p) => p.name === i.who);
    if (who) out.who = who.name;
    const sc = SCENARIO_KEYS.find((k) => STRESS_SCEN[k] === i.scenario);
    if (sc) out.sc = sc;
    const l = i.levers as Record<string, unknown> | undefined;
    if (l && typeof l === "object") {
      out.levers = { top: (num(l.sumInsuredPct) ?? 100) > 100, net: l.claimDelayDays === 0, room: l.roomUpgrade === false };
    }
    return out;
  },
};

// ---- Review ----------------------------------------------------------------------------------------------------------------
export type ReviewCodec = { st: ReviewState };
export const reviewCodec: Codec<ReviewCodec> = {
  encode: ({ st }) => {
    const items: Record<string, { status: string; value?: string }> = {};
    for (const [i, choice] of Object.entries(st.dec)) items[`dec-${i}`] = choice === 0 ? { status: "accepted", value: "0" } : { status: "edited", value: String(choice) };
    for (const [i, on] of Object.entries(st.ok)) if (on) items[`look-${i}`] = { status: "accepted" };
    for (const [i, on] of Object.entries(st.ch)) if (on) items[`look-${i}`] = { status: "rejected" };
    return { items };
  },
  decode: (i) => {
    const st: ReviewState = { dec: {}, ok: {}, ch: {} };
    const items = i.items && typeof i.items === "object" ? (i.items as Record<string, { status?: unknown; value?: unknown }>) : {};
    for (const [key, item] of Object.entries(items)) {
      const m = /^(dec|look)-(\d{1,3})$/.exec(key);
      if (!m) continue;
      const idx = Number(m[2]);
      if (m[1] === "dec") st.dec[idx] = item.status === "edited" ? Math.max(0, Number(item.value) || 0) : 0;
      else if (item.status === "accepted") st.ok[idx] = true;
      else if (item.status === "rejected") st.ch[idx] = true;
    }
    return { st };
  },
};
