// Guards audit rows from issue #107: no hard-coded colour in the touched CSS modules, and the
// contrast of every pair whose colours changed, computed from tokens.css (light and dark).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const tokens = read("src/styles/tokens.css");
const covers = read("src/components/covers/covers.module.css");
const tools = read("src/components/tools/tools.module.css");

function block(selector: RegExp): Record<string, string> {
  const m = tokens.match(selector);
  if (!m) throw new Error("block missing");
  const out: Record<string, string> = {};
  for (const [, k, v] of m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) out[k] = v;
  return out;
}
const light = block(/:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/) };

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("no hard-coded colour in touched modules", () => {
  it.each([["covers.module.css", covers], ["tools.module.css", tools]])("%s", (_n, css) => {
    expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi)).toBeNull();
  });
});

describe("row 6: done-step tick", () => {
  it("uses --on-harbour on --harbour", () => {
    expect(covers).toMatch(/\.step\[data-step="done"\] \.stepDot \{[^}]*color: var\(--on-harbour\)/);
  });
  it.each([["light", light], ["dark", dark]] as const)("%s: tick is at least 4.5:1", (_n, t) => {
    expect(ratio(t["on-harbour"], t.harbour)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("row 13: todo steps", () => {
  it("drops opacity and keeps a hollow, graphite-edged dot", () => {
    expect(covers).not.toMatch(/opacity/);
    expect(covers).toMatch(/\.step\[data-step="todo"\] \.stepDot \{ border-color: var\(--graphite\); \}/);
  });
  it.each([["light", light], ["dark", dark]] as const)("%s: graphite label on sheet is at least 4.5:1", (_n, t) => {
    expect(ratio(t.graphite, t.sheet)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("row 22: inverted panel", () => {
  it("book and darkCard read the panel tokens", () => {
    expect(tools).toMatch(/\.book \{ background: var\(--panel-inverse-bg\)[^}]*var\(--panel-inverse-edge\)/);
    expect(tools).toMatch(/\.darkCard \{ background: var\(--panel-inverse-bg\)[^}]*var\(--panel-inverse-edge\)/);
  });
  it.each([["light", light], ["dark", dark]] as const)("%s: paper text on panel is at least 4.5:1", (_n, t) => {
    expect(ratio(t["paper-fixed"], t["panel-inverse-bg"])).toBeGreaterThanOrEqual(4.5);
  });
  it("dark: panel edge separates the card from the page (at least 3:1)", () => {
    expect(ratio(dark["panel-inverse-edge"], dark.paper)).toBeGreaterThanOrEqual(3);
  });
  it("dark: panel fill is not the page colour", () => {
    expect(dark["panel-inverse-bg"]).not.toBe(dark.paper);
  });
});

describe("row 32: step pulse", () => {
  it("is built from --harbour, not the old teal", () => {
    expect(covers).toMatch(/color-mix\(in srgb, var\(--harbour\) 45%/);
    expect(covers).not.toContain("--step-pulse-fixed");
  });
});
