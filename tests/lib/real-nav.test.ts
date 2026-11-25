import { describe, expect, it } from "vitest";
import { GROUPS, PAGES, groupHome, navHref, pagesIn } from "@/lib/ia";

const DEAD_END_FOR_REAL = ["/assistant", "/cards", "/desk", "/shortcuts", "/review"];
const emergency = PAGES.find((p) => p.route === "/emergency")!;

describe("nav for real (backend) accounts, issue #104", () => {
  const realTabs = GROUPS.flatMap((g) => pagesIn(g.id, "real").map((p) => p.route));

  it("hides every page that opens 'cannot use it yet'", () => {
    for (const r of DEAD_END_FOR_REAL) expect(realTabs).not.toContain(r);
  });

  it("keeps the real twins of the overlapping pairs", () => {
    expect(realTabs).toContain("/covers/review");
    expect(realTabs).toContain("/chat");
  });

  it("sends Emergency to network hospitals and the Help crumb off /desk", () => {
    expect(navHref(emergency, "real")).toBe("/hospitals");
    expect(groupHome(GROUPS.find((g) => g.id === "help")!, "real")).not.toBe("/desk");
  });

  it("leaves the demo nav unchanged", () => {
    const demoTabs = GROUPS.flatMap((g) => pagesIn(g.id).map((p) => p.route));
    for (const r of ["/assistant", "/cards", "/desk", "/review", "/emergency"]) expect(demoTabs).toContain(r);
    expect(pagesIn("cover", "demo")).toEqual(pagesIn("cover"));
    expect(navHref(emergency, "demo")).toBe("/emergency");
    expect(groupHome(GROUPS.find((g) => g.id === "help")!, "demo")).toBe("/desk");
  });
});
