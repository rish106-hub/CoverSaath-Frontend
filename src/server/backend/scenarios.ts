import "server-only";
import { z } from "zod";
import { DataError, type Send } from "./user-data";
import type { SessionPayload } from "./session";

// Scenario routes. The allow-lists below mirror the backend contract (src/contracts/user-data.js): strict objects, closed enums,
// bounded numbers, every field optional so a half-filled form can be saved. The backend validates again; this is the first gate.

export const SCENARIO_TOOLS = ["tax", "premium_rise", "hospital_bill", "inflation", "compare_weights", "stress_levers", "review_state"] as const;
export type ScenarioTool = (typeof SCENARIO_TOOLS)[number];

const rupees = (max: number) => z.number().int().min(0).max(max);
const pct = (min: number, max: number) => z.number().min(min).max(max);
const whole = (min: number, max: number) => z.number().int().min(min).max(max);
const subject = z.string().regex(/^(household|[A-Za-z0-9_.:-]{1,100})$/);
const weight = whole(0, 100);

const SCHEMAS: Record<ScenarioTool, z.ZodType<Record<string, unknown>>> = {
  tax: z.strictObject({
    regime: z.enum(["old", "new"]), ageBand: z.enum(["under60", "60to80", "above80"]), annualIncome: rupees(1e9), deduction80c: rupees(1.5e6),
    deduction80d: rupees(1e6), hraExemption: rupees(1e8), homeLoanInterest: rupees(1e7), premiumsPaid: rupees(1e7), shareWithFamily: z.boolean(),
  }).partial(),
  premium_rise: z.strictObject({
    currentPremium: rupees(1e7), sumInsured: rupees(1e9), riseRatePct: pct(0, 100), years: whole(1, 40), ageNow: whole(0, 120), shareWithFamily: z.boolean(),
  }).partial(),
  hospital_bill: z.strictObject({
    billAmount: rupees(1e8), sumInsured: rupees(1e9), roomRentCap: rupees(1e6), roomRentActual: rupees(1e6), coPayPct: pct(0, 100),
    deductible: rupees(1e8), nonPayableItems: rupees(1e8), daysAdmitted: whole(0, 365), networkHospital: z.boolean(),
  }).partial(),
  inflation: z.strictObject({
    who: subject, caseKind: z.enum(["hospitalisation", "maternity", "cardiac", "cancer", "orthopaedic", "dialysis"]),
    medicalInflationPct: pct(0, 50), years: whole(1, 40), currentCost: rupees(1e9), coverToday: rupees(1e9),
  }).partial(),
  compare_weights: z.strictObject({
    kind: z.enum(["individual", "family_floater", "top_up", "group"]), ageBand: z.enum(["0-17", "18-30", "31-45", "46-60", "61+"]),
    scenario: z.enum(["routine", "planned_surgery", "critical_illness", "maternity", "emergency"]),
    weights: z.strictObject({ price: weight, coverage: weight, network: weight, claims: weight, waitingPeriods: weight, restoration: weight }).partial(),
  }).partial(),
  stress_levers: z.strictObject({
    who: subject, scenario: z.enum(["major_surgery", "critical_illness", "accident", "maternity", "long_stay"]),
    levers: z.strictObject({
      billMultiplierPct: whole(50, 500), roomUpgrade: z.boolean(), coPayPct: whole(0, 100), deductible: rupees(1e7), claimDelayDays: whole(0, 180), sumInsuredPct: whole(10, 300),
    }).partial(),
  }).partial(),
  review_state: z.strictObject({
    items: z.record(
      z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
      z.strictObject({ status: z.enum(["pending", "accepted", "edited", "rejected"]), value: z.string().max(200).optional() }),
    ).refine((o) => Object.keys(o).length <= 200),
  }).partial(),
};

export const scenarioTool = z.enum(SCENARIO_TOOLS);

const stored = z.object({
  tool: z.string(),
  inputs: z.record(z.string(), z.unknown()).nullable(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().nullish(),
}).loose();
const listed = z.object({ scenarios: z.array(stored) }).loose();

export type ScenarioView = { tool: string; inputs: Record<string, unknown> | null; revision: number };
const view = (s: z.infer<typeof stored>): ScenarioView => ({ tool: s.tool, inputs: s.inputs, revision: s.revision });

function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new DataError(502, "BACKEND_BAD_RESPONSE");
  return r.data;
}

const base = (s: SessionPayload) => `/api/v1/households/${encodeURIComponent(s.h)}/scenarios`;

export function scenarioService(send: Send, session: SessionPayload) {
  return {
    async list(): Promise<ScenarioView[]> {
      return parse(listed, await send("GET", base(session), { token: session.t })).scenarios.map(view);
    },
    async get(tool: unknown): Promise<ScenarioView> {
      const t = scenarioTool.safeParse(tool);
      if (!t.success) throw new DataError(400, "INVALID_INPUT");
      return view(parse(stored, await send("GET", `${base(session)}/${t.data}`, { token: session.t })));
    },
    async put(tool: unknown, body: unknown, revision: number | undefined): Promise<ScenarioView> {
      const t = scenarioTool.safeParse(tool);
      const b = z.strictObject({ inputs: z.unknown() }).safeParse(body);
      if (!t.success || !b.success) throw new DataError(400, "INVALID_INPUT");
      const inputs = SCHEMAS[t.data].safeParse(b.data.inputs);
      if (!inputs.success) throw new DataError(400, "INVALID_INPUT");
      const out = await send("PUT", `${base(session)}/${t.data}`, { token: session.t, json: { inputs: inputs.data }, ifMatch: revision });
      return view(parse(stored, out));
    },
  };
}

/** If-Match from the browser: a whole revision number, or absent. Anything else is refused. */
export function parseRevision(header: string | null): number | undefined {
  if (header === null || header === "") return undefined;
  if (!/^\d{1,9}$/.test(header)) throw new DataError(400, "INVALID_INPUT");
  return Number(header);
}
