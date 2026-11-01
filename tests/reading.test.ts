import { describe, expect, it } from "vitest";
import { PAGES, TOPICS, topicPageKey } from "@/data/mock/policy";

describe("reading room data", () => {
  it("every located topic points at a page that exists and contains its marked clause", () => {
    for (const t of TOPICS.filter((x) => x.at)) {
      const key = t.at as string;
      expect(PAGES[key], key).toBeDefined();
      expect(PAGES[key].paras.some((p) => p.topic === t.id && p.mark), t.id).toBe(true);
    }
  });
  it("the ICU topic shows the schedule's own line when the schedule tab is open", () => {
    const icu = TOPICS.find((t) => t.id === "icu")!;
    expect(topicPageKey(icu, "schedule")).toBe("schedule:2");
    expect(PAGES["schedule:2"].paras.some((p) => p.topic === "icu")).toBe(true);
    expect(topicPageKey(icu, "policy")).toBe("policy:4");
  });
  it("only the disagreeing topic is flagged, and the not-found topic has no page", () => {
    expect(TOPICS.filter((t) => t.disagrees).map((t) => t.id)).toEqual(["icu"]);
    expect(TOPICS.find((t) => t.id === "copay")?.at).toBeNull();
  });
});
