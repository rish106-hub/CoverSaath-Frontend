import { describe, expect, it } from "vitest";
import { planInflation, formatLakh, formatRs } from "@/lib/inflation";
import { reconcileReceipts, findDuplicates, summariseReceipts } from "@/lib/reconcile";
import { section80D, roomRent, topUpFinder, formatLakhShort } from "@/lib/calculators";
import { receipts } from "@/data/mock";

const parents = { coverLakh: 3, premiumRs: 31700, premiumGrowth: 0.12 };
const you = { coverLakh: 5, premiumRs: 7900, premiumGrowth: 0.07 };

describe("inflation planner (Money board)", () => {
  it("heart bypass Rs 6.5L at 12% becomes about Rs 20L in 10 years", () => {
    const p = planInflation({ ...parents, costTodayLakh: 6.5, ratePct: 12, years: 10 });
    expect(formatLakh(p.costAtEndLakh)).toBe("Rs 20.2L");
    expect(p.crossOffset).toBe(0);
    expect(p.crossYear).toBe(2026);
    expect(p.needLakh).toBe(25);
    expect(p.points).toHaveLength(11);
    expect(p.points.every((x) => x.aboveCover)).toBe(true);
  });
  it("knee replacement stays inside Rs 5L until 2029 at 12%", () => {
    const p = planInflation({ ...you, costTodayLakh: 3.8, ratePct: 12, years: 10 });
    expect(p.crossYear).toBe(2029);
    expect(p.points[0]?.aboveCover).toBe(false);
  });
  it("no crossing inside the horizon reports outOfDate=false", () => {
    const p = planInflation({ ...you, costTodayLakh: 1, ratePct: 10, years: 5 });
    expect(p.outOfDate).toBe(false);
    expect(p.crossYear).toBeNull();
  });
  it("steps every 2 years past 10 years, premium grows", () => {
    const p = planInflation({ ...parents, costTodayLakh: 6.5, ratePct: 12, years: 20 });
    expect(p.points).toHaveLength(11);
    expect(p.points[1]?.offset).toBe(2);
    expect(formatRs(p.premiumAtEndRs)).toBe("Rs 3,05,787");
    expect(p.premiumsPaidRs).toBeGreaterThan(p.premiumAtEndRs);
  });
  it("formats crores and lakh", () => {
    expect(formatLakh(150)).toBe("Rs 1.5 Cr");
    expect(formatLakh(6.5)).toBe("Rs 6.5L");
  });
});

describe("reconcile (Money board)", () => {
  const rs = [
    { id: "a", amountRs: 15850, date: "2026-03-09", policyNumber: "MC-1" },
    { id: "b", amountRs: 15850, date: "2026-03-11", policyNumber: "MC-1" },
    { id: "c", amountRs: 7900, date: "2026-06-14" },
    { id: "d", amountRs: 8200, date: "2026-04-02" },
  ];
  const ex = [
    { id: "e1", amountRs: 15850, dueDate: "2026-03-13", policyNumber: "MC-1" },
    { id: "e2", amountRs: 7900, dueDate: "2026-06-14" },
    { id: "e3", amountRs: 8200, dueDate: "2026-04-01" },
    { id: "e4", amountRs: 5000, dueDate: "2026-07-01" },
  ];
  it("matches the first payment, flags the second as a duplicate and a Rs 15,850 refund", () => {
    const r = reconcileReceipts(rs, ex);
    expect(r.matches).toEqual([{ expectedId: "e1", receiptId: "a" }, { expectedId: "e2", receiptId: "c" }, { expectedId: "e3", receiptId: "d" }]);
    expect(r.duplicates).toEqual([{ receiptId: "b", ofReceiptId: "a", amountRs: 15850 }]);
    expect(r.refundRs).toBe(15850);
    expect(r.unmatchedExpected).toEqual(["e4"]);
  });
  it("tolerates Rs 1 but not Rs 2", () => {
    expect(reconcileReceipts([{ id: "x", amountRs: 7901, date: "2026-06-14" }], [ex[1]!]).matches).toHaveLength(1);
    expect(reconcileReceipts([{ id: "x", amountRs: 7902, date: "2026-06-14" }], [ex[1]!]).matches).toHaveLength(0);
  });
  it("respects the date window", () => {
    expect(reconcileReceipts([{ id: "x", amountRs: 7900, date: "2026-07-20" }], [ex[1]!]).unmatchedExpected).toEqual(["e2"]);
  });
  it("a different policy number never matches", () => {
    const r = reconcileReceipts([{ id: "x", amountRs: 15850, date: "2026-03-09", policyNumber: "ZZ-9" }], [ex[0]!]);
    expect(r.matches).toHaveLength(0);
    expect(r.unmatchedReceipts).toEqual(["x"]);
  });
  it("findDuplicates ignores other keys and far dates", () => {
    expect(findDuplicates([{ id: "1", amountRs: 5, date: "2026-01-01", key: "a" }, { id: "2", amountRs: 5, date: "2026-01-02", key: "b" }])).toHaveLength(0);
    expect(findDuplicates([{ id: "1", amountRs: 5, date: "2026-01-01", key: "a" }, { id: "2", amountRs: 5, date: "2026-03-02", key: "a" }])).toHaveLength(0);
  });
  it("adapter summary finds the second Kaveri debit", () => {
    expect(summariseReceipts(receipts)).toEqual({ matched: 4, duplicates: 1, refundRs: 8400 });
  });
});

describe("calculators (Tools board)", () => {
  it("80D old regime caps: Rs 25k self, Rs 25k or 50k parents", () => {
    expect(section80D({ regime: "old", selfRs: 6200, parentsRs: 38400, senior: true })).toMatchObject({ self: 6200, parents: 38400, total: 44600 });
    expect(section80D({ regime: "old", selfRs: 40000, parentsRs: 60000, senior: false })).toMatchObject({ self: 25000, parents: 25000, total: 50000 });
    expect(section80D({ regime: "old", selfRs: 40000, parentsRs: 60000, senior: true }).total).toBe(75000);
  });
  it("80D is nil under the new regime", () => {
    expect(section80D({ regime: "new", selfRs: 40000, parentsRs: 60000, senior: true })).toMatchObject({ total: 0, available: false });
  });
  it("room rent: Rs 8,000 room on Rs 5L at 1% leaves Rs 1,20,000 other charges 37.5% paid", () => {
    const r = roomRent({ coverRs: 500000, limitPct: 1, roomPerDayRs: 8000, otherRs: 120000 });
    expect(r.eligible).toBe(5000);
    expect(r.over).toBe(true);
    expect(r.ratio).toBeCloseTo(0.625);
    expect(r.youPayOther).toBeCloseTo(45000);
  });
  it("room rent within limit pays everything", () => {
    expect(roomRent({ coverRs: 500000, limitPct: 2, roomPerDayRs: 8000, otherRs: 100 }).youPayOther).toBe(0);
  });
  it("top-up: Rs 5L base, Rs 12L bypass: you pay Rs 7L, Rs 10L top-up takes it to Rs 0", () => {
    const t = topUpFinder({ whoIndex: 1, baseLakh: 5, billLakh: 12 });
    expect(t.fitIndex).toBe(0);
    expect(t.youNow).toBe(7);
    expect(t.youAfter).toBe(0);
    expect(t.options.map((o) => o.fit)).toEqual(["recommended", "also-works", "too-small"]);
    expect(t.options[0]?.premiumRs).toBe(9500);
  });
  it("top-up: Rs 25L base already covers, fit is the smallest", () => {
    const t = topUpFinder({ whoIndex: 0, baseLakh: 25, billLakh: 12 });
    expect(t.gap).toBe(0);
    expect(t.youNow).toBe(0);
    expect(t.fitIndex).toBe(2);
  });
  it("top-up: too-small pick leaves a remainder", () => {
    const t = topUpFinder({ whoIndex: 0, baseLakh: 5, billLakh: 18, pick: 2 });
    expect(t.youAfter).toBe(8);
    expect(formatLakhShort(t.youAfter)).toBe("Rs 8L");
    expect(formatLakhShort(0.45)).toBe("Rs 45,000");
  });
});
