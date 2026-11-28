import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("touch targets and mobile layout (#84)", () => {
  it("raises the small button height to 44px on coarse pointers only", () => {
    const tokens = read("src/styles/tokens.css");
    expect(tokens).toMatch(/--btn-h-sm: 36px/);
    expect(tokens).toMatch(/@media \(pointer: coarse\) \{\s*:root \{ --btn-h-sm: 44px; \}/);
  });
  it("gives sidebar links, header icon buttons, dismiss and tool chips 44px on coarse pointers", () => {
    // The rail is laptop-only (R2) and its links are 46px high on every pointer, so no coarse-pointer override is needed.
    const rail = read("src/components/shell/AppSidebar.module.css");
    expect(rail).toMatch(/\.item, \.on \{[^}]*height: 46px/);
    expect(rail).toMatch(/\.emergency, \.settings \{[^}]*height: 46px/);
    expect(read("src/components/agent/agent.module.css")).toMatch(/pointer: coarse\) \{ \.headMic \{ width: 44px; height: 44px; \}/);
    expect(read("src/components/theme/ThemeButton.module.css")).toMatch(/pointer: coarse\) \{ \.btn \{ width: 44px; height: 44px; \}/);
    expect(read("src/components/shell/TrialNotice.module.css")).toMatch(/pointer: coarse\) \{ \.x \{[^}]*min-height: 44px/);
    expect(read("src/components/tools/tools.module.css")).toMatch(/pointer: coarse\) \{\s*\.segBtn, \.chip, \.bchip, \.share \{ min-height: 44px; \}/);
  });
  it("lets page titles shrink and wrap", () => {
    expect(read("src/styles/tokens.css")).toMatch(/--fs-fluid-page-title: clamp\(30px, 7vw, 52px\)/);
    expect(read("src/components/type/type.module.css")).toMatch(/overflow-wrap: anywhere; text-wrap: balance/);
  });
  it("exempts the /home greeting block from the entrance animation", () => {
    expect(read("src/styles/globals.css")).toMatch(/\.k-content > \.k-no-fade \{ animation: none; \}/);
    expect(read("src/components/shell/HomeGreeting.tsx")).toMatch(/className="k-no-fade"/);
  });
  it("drops the sign-in photograph to one column under 900px and moves the welcome padding to a module", () => {
    expect(read("src/components/public/signin.module.css")).toMatch(/max-width: 900px\) \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*\.photo \{ display: none; \}/);
    expect(read("src/app/welcome/page.tsx")).not.toMatch(/padding: "72px 48px"/);
    expect(read("src/app/welcome/welcome.module.css")).toMatch(/padding: 32px 16px/);
  });
  it("loads the Blob client on demand, not at module top level", () => {
    const src = read("src/adapters/uploads.ts");
    expect(src).not.toMatch(/^import .*@vercel\/blob/m);
    expect(src).toMatch(/await import\("@vercel\/blob\/client"\)/);
  });
  it("pins a modern browserslist", () => {
    expect(JSON.parse(read("package.json")).browserslist).toEqual(["chrome >= 111", "edge >= 111", "firefox >= 111", "safari >= 16.4"]);
  });
});
