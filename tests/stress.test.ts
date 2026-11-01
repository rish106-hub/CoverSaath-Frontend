import { describe, expect, it } from "vitest";
import { PEOPLE, SCENARIO_KEYS, SCENARIOS, calc, leverSaving, verdict, waterfall, familyRow, type Levers, type Person, type Scenario } from "@/lib/stress";

// Literal copy of the board's calc(who, sc, o) in design/Policy.dc.html, used as the reference.
function boardCalc(who: string, sc: string, o: { top: boolean; net: boolean; room: boolean }) {
  const S: Record<string, number> = { dengue: 85000, knee: 380000, heart: 650000, cat: 55000, birth: 140000, icu: 520000 };
  const bill = S[sc];
  const parent = who === "Father" || who === "Mother";
  const cover = parent ? 300000 : 500000;
  const sub = parent && sc === "knee" ? 200000 : parent && sc === "cat" ? 40000 : Infinity;
  const copay = parent ? 0.2 : 0;
  const nonPay = Math.round(bill * (o.net ? 0.035 : 0.06));
  const roomCut = o.room ? 0 : Math.round(Math.min(bill - nonPay, cover) * (parent ? 0.1 : 0.06));
  const eligible = Math.min(bill - nonPay - roomCut, sub);
  const coAmt = eligible * copay;
  const ins = Math.min(eligible - coAmt, cover);
  const hasTop = o.top || who === "Meera";
  const topPays = !hasTop ? 0 : parent ? Math.max(0, bill - nonPay - ins) : Math.max(0, Math.min(1000000, bill - nonPay - Math.max(ins, 500000)));
  const you = Math.max(0, bill - ins - topPays);
  return { bill, nonPay, roomCut, sub, coAmt, ins, topPays, you, parent, cover };
}

const LEVERS: Levers[] = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ top: !!(n & 1), net: !!(n & 2), room: !!(n & 4) }));
const names = PEOPLE.map((p) => p.name);

describe("stress calc matches the board for every scenario x person x lever set", () => {
  for (const who of names) {
    for (const sc of SCENARIO_KEYS) {
      it(`${who} / ${sc}`, () => {
        for (const o of LEVERS) expect(calc(who, sc, o)).toEqual(boardCalc(who, sc, o));
      });
    }
  }
});

describe("known figures", () => {
  it("Father, knee, no levers (board default)", () => {
    const r = calc("Father", "knee", { top: false, net: false, room: false });
    expect(r.nonPay).toBe(22800);
    expect(r.roomCut).toBe(30000);
    expect(r.coAmt).toBe(40000);
    expect(r.ins).toBe(160000);
    expect(r.topPays).toBe(0);
    expect(r.you).toBe(220000);
  });
  it("Meera has the top-up without the lever; Rohan only with it", () => {
    const off = { top: false, net: false, room: false };
    expect(calc("Meera", "heart", off).topPays).toBeGreaterThan(0);
    expect(calc("Rohan", "heart", off).topPays).toBe(0);
    expect(calc("Rohan", "heart", { ...off, top: true }).topPays).toBeGreaterThan(0);
  });
  it("top-up for a parent pays everything the base plan leaves, so a parent heart bypass costs only non-payable items", () => {
    const r = calc("Mother", "heart", { top: true, net: false, room: false });
    expect(r.you).toBe(r.nonPay);
  });
});

describe("invariants", () => {
  it("you + insurer + top-up = bill, nothing negative", () => {
    for (const who of names) for (const sc of SCENARIO_KEYS) for (const o of LEVERS) {
      const r = calc(who as Person, sc as Scenario, o);
      expect(r.you).toBeGreaterThanOrEqual(0);
      expect(r.ins).toBeGreaterThanOrEqual(0);
      expect(r.you + r.ins + r.topPays).toBeGreaterThanOrEqual(r.bill - 1);
    }
  });
  it("a lever never makes things worse", () => {
    for (const who of names) for (const sc of SCENARIO_KEYS) for (const k of ["top", "net", "room"] as const)
      expect(leverSaving(who as Person, sc, { top: false, net: false, room: false }, k)).toBeGreaterThanOrEqual(0);
  });
  it("a lever that is already on saves nothing", () => {
    expect(leverSaving("Father", "knee", { top: true, net: false, room: false }, "top")).toBe(0);
  });
});

describe("verdict and waterfall", () => {
  it("thresholds", () => {
    expect(verdict(19999).label).toBe("Manageable");
    expect(verdict(20000).label).toBe("Heavy");
    expect(verdict(100000).label).toBe("Big gap");
  });
  it("waterfall has seven rows, starting with the full bill, and cuts stay inside the bar", () => {
    for (const who of names) for (const sc of SCENARIO_KEYS) {
      const o = { top: false, net: false, room: false };
      const rows = waterfall(who as Person, calc(who as Person, sc, o), o);
      expect(rows).toHaveLength(7);
      expect(rows[0].value).toBe("Rs " + SCENARIOS[sc].bill.toLocaleString("en-IN"));
      for (const r of rows.slice(1, 5)) expect(r.x + r.w).toBeLessThanOrEqual(101);
    }
  });
  it("family row shares sum to 100", () => {
    const f = familyRow("Father", "knee", { top: false, net: false, room: false });
    expect(f.insPct + f.youPct).toBe(100);
  });
});
