import { describe, expect, it } from "vitest";
import { accept, acceptAll, emptyReview, flag, nextLook, pick, summarize, tick } from "@/components/cover/review-logic";
import { formatStat } from "@/components/cover/CountUp";
import { decisions, lookItems, reviewTotal } from "@/data/mock/review";
import { glanceTiles } from "@/data/mock/home";

const sum = (s = emptyReview) => summarize(s, reviewTotal, decisions.length, lookItems.length);

describe("review logic", () => {
  it("starts with every decision and look item open", () => {
    const r = sum();
    expect(r.left).toBe(14);
    expect(r.done).toBe(30);
    expect(r.pct).toBe(68);
    expect(r.headline).toBe("14 things need you. Knowvia handled the rest.");
    expect(r.next).toBe(0);
  });
  it("accept all takes the recommended option for open decisions only", () => {
    const s = acceptAll(pick(emptyReview, 1, 1), decisions.length);
    expect(Object.values(s.dec)).toEqual([0, 1, 0, 0, 0, 0]);
    expect(sum(s).left).toBe(8);
  });
  it("accept keeps an earlier pick", () => {
    expect(accept(pick(emptyReview, 2, 1), 2).dec[2]).toBe(1);
  });
  it("A/C act on the next unreviewed look item and move on", () => {
    let s = tick(emptyReview, nextLook(emptyReview, 8));
    expect(nextLook(s, 8)).toBe(1);
    s = flag(s, 1);
    expect(nextLook(s, 8)).toBe(2);
    expect(sum(s).left).toBe(13);
  });
  it("tick toggles and clears a flag; flagged items still count as open", () => {
    const f = flag(emptyReview, 0);
    expect(sum(f).left).toBe(14);
    const t = tick(f, 0);
    expect(t.ch[0]).toBe(false);
    expect(sum(t).left).toBe(13);
    expect(sum(tick(t, 0)).left).toBe(14);
  });
  it("finishes with the all-set headline", () => {
    let s = acceptAll(emptyReview, decisions.length);
    lookItems.forEach((_, i) => (s = tick(s, i)));
    const r = sum(s);
    expect(r.left).toBe(0);
    expect(r.pct).toBe(100);
    expect(r.next).toBe(-1);
    expect(r.headline).toMatch(/^All set/);
  });
  it("singular headline", () => {
    let s = acceptAll(emptyReview, decisions.length);
    lookItems.slice(1).forEach((_, i) => (s = tick(s, i + 1)));
    expect(sum(s).headline).toBe("1 thing needs you. Knowvia handled the rest.");
  });
});

describe("home stats", () => {
  it("formats board values", () => {
    const f = glanceTiles.filter((t) => t.stat).map((t) => formatStat(t.stat!));
    expect(f).toEqual(["Rs 23L", "Rs 21.5L", "Rs 5,308", "Rs 75,000"]);
  });
  it("formats mid-count values without overshoot", () => {
    expect(formatStat({ prefix: "Rs ", value: 5308, group: true }, 1000.4)).toBe("Rs 1,000");
  });
});
