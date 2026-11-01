import { describe, expect, it } from "vitest";
import { GROUPS, PAGES, pageFor, pagesIn } from "@/lib/ia";

describe("information architecture", () => {
  it("has four groups", () => expect(GROUPS.map((g) => g.label)).toEqual(["My cover", "My family", "My money", "Help"]));

  it("every grouped route belongs to exactly one group and is listed once as a tab", () => {
    const tabbed = GROUPS.flatMap((g) => pagesIn(g.id).map((p) => p.route));
    expect(new Set(tabbed).size).toBe(tabbed.length);
    for (const p of PAGES.filter((x) => x.group && !x.route.includes("["))) {
      expect(GROUPS.filter((g) => pagesIn(g.id).some((t) => t.route === p.route))).toHaveLength(1);
    }
  });

  it("covers every route in BUILD-SPEC section 4", () => {
    const routes = PAGES.map((p) => p.route);
    for (const r of ["/home", "/policies", "/policies/[id]", "/stress-test", "/compare", "/review", "/family", "/cards", "/money", "/tools", "/desk", "/emergency", "/assistant", "/shortcuts", "/settings", "/profile"]) expect(routes).toContain(r);
  });

  it("route patterns are unique", () => expect(new Set(PAGES.map((p) => p.route)).size).toBe(PAGES.length));

  it("resolves dynamic policy routes", () => expect(pageFor("/policies/abc")?.route).toBe("/policies/[id]"));

  it("has no banned words in titles or headings", () => {
    const text = PAGES.flatMap((p) => [p.title, p.kicker ?? "", ...p.sections.map((s) => s.heading)]).join(" ");
    expect(text).not.toMatch(/sample|demo|preview|draft|placeholder|lorem|not advice|not an insurer|CoverSaath|Saath/i);
  });
});
