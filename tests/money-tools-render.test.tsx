import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ToolsPage } from "@/components/tools/ToolsPage";
import { MoneyDesk } from "@/components/money/MoneyDesk";
import { InflationPlanner } from "@/components/money/InflationPlanner";

const BANNED = /sample|demo|preview|draft|placeholder|lorem|not advice|not an insurer|CoverSaath|Saath/i;

describe("money and tools render", () => {
  it("tools page has every board section and no banned words", () => {
    const html = renderToStaticMarkup(<ToolsPage />);
    for (const h of ["Section 80D", "Top-up finder", "Registered advisors", "What these tools saved families like yours"]) expect(html).toContain(h);
    expect(html).toContain("Rs 44,600");
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(BANNED);
  });
  it("planner defaults to 12% and reads the board headline", () => {
    const html = renderToStaticMarkup(<InflationPlanner />);
    expect(html).toContain("change it if you like");
    expect(html).toContain("about Rs 20.2L in 2036");
    expect(html).toContain("Recommended");
  });
  it("money desk has its sections", () => {
    const html = renderToStaticMarkup(<MoneyDesk />);
    for (const h of ["Found in your inbox", "Coming up", "Money on its way back", "Premium and cover, years ahead"]) expect(html).toContain(h);
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(BANNED);
  });
});
