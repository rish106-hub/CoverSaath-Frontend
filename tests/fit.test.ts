import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, SCENARIOS, bestIndex, cycleWeight, fitScores, lakh, plans, rows, verdictText, youPaysL } from "@/lib/fit";

describe("fit scores", () => {
  const r = rows(10);
  it("matches the board defaults", () => {
    // Hand-computed: weights 1,2,0,1,1,1,1,2 (total 9).
    expect(fitScores(r, DEFAULT_WEIGHTS)).toEqual([67, 94, 67, 100]);
  });
  it("best plan is never today's cover", () => {
    expect(bestIndex(fitScores(r, DEFAULT_WEIGHTS))).toBe(3);
    expect(bestIndex([99, 10, 20, 30])).toBe(3);
  });
  it("turning co-pay up to High favours plans without co-pay", () => {
    const s = fitScores(r, { ...DEFAULT_WEIGHTS, 2: 3 });
    expect(s[2]).toBeLessThan(fitScores(r, DEFAULT_WEIGHTS)[2]);
  });
  it("scores are 0 to 100, and all-off still scores from always-on rows", () => {
    const off = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of fitScores(r, off)) expect(s).toBeGreaterThanOrEqual(0), expect(s).toBeLessThanOrEqual(100);
    expect(fitScores(r, off)[1]).toBe(100);
  });
  it("weights cycle Off, Low, Medium, High, Off", () => {
    expect([0, 1, 2, 3].map(cycleWeight)).toEqual([1, 2, 3, 0]);
  });
});

describe("what you pay", () => {
  it("today's cover on a bypass: shared Rs 5L then 6% non-payable and room cut", () => {
    const p = plans("top", 10);
    expect(youPaysL(p[0], 0, 6.5, "top")).toBeCloseTo(1.5 + 6.5 * 0.06 + 5 * 0.08, 6);
  });
  it("a top-up absorbs the gap above Rs 5L, a base plan only above its own cover", () => {
    const top = plans("top", 10)[1];
    const base = plans("base", 5)[1];
    expect(youPaysL(top, 1, 14, "top")).toBeCloseTo(0 + 14 * 0.03, 6);
    expect(youPaysL(base, 1, 14, "base")).toBeCloseTo(9 + 14 * 0.03, 6);
  });
  it("lakh formatting", () => {
    expect(lakh(0)).toBe("Rs 0");
    expect(lakh(0.85)).toBe("Rs 85,000");
    expect(lakh(1.94)).toBe("Rs 1.9L");
  });
  it("verdict mentions the pick and both amounts", () => {
    const list = plans("top", 10);
    const t = verdictText(1, list, [67, 94, 67, 100], 0, "top");
    expect(t).toContain("Kaveri General Super Top-up");
    expect(t).toContain("instead of");
    expect(verdictText(0, list, [67, 94, 67, 100], 0, "top")).toContain("67%");
  });
  it("has four scenarios and four plans", () => {
    expect(SCENARIOS).toHaveLength(4);
    expect(plans("base", 25)).toHaveLength(4);
  });
});
