import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/tokens.css", "utf8");

function block(selector: RegExp): Record<string, string> {
  const m = css.match(selector);
  if (!m) throw new Error("block missing");
  const out: Record<string, string> = {};
  for (const [, k, v] of m[1].matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[k] = v;
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

// [text token, surface token]
const PAIRS: [string, string][] = [
  ["ink", "paper"], ["ink", "sheet"], ["ink", "sunken"], ["ink", "mist"],
  ["graphite", "paper"], ["graphite", "sheet"], ["graphite", "sunken"],
  ["harbour", "paper"], ["harbour", "sheet"],
  ["on-harbour", "harbour"],
  ["rec-ink", "rec-bg"],
  ["signal-ink", "signal-bg"], ["signal-ink", "paper"],
  ["coral-ink", "coral"],
  ["g-cover", "paper"], ["g-family", "paper"], ["g-money", "paper"], ["g-help", "paper"],
  ["signal-bg", "signal-ink"], ["g-cover", "sheet"], ["g-family", "sheet"], ["g-money", "sheet"], ["g-help", "sheet"],
];

describe.each([["light", light], ["dark", dark]] as const)("%s theme contrast", (_n, t) => {
  it.each(PAIRS)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(t[fg], `token ${fg}`).toBeDefined();
    expect(t[bg], `token ${bg}`).toBeDefined();
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

it("defines the spec palette in light", () => {
  expect(light.paper).toBe("#f7f5f0");
  expect(light.harbour).toBe("#0e4f4a");
  expect(light["rec-bg"]).toBe("#eae6f2");
});

// Emergency is light by default. Its fixed colours (white e-card, call tiles) must read in both themes.
const emergency = readFileSync("src/components/help/Emergency.module.css", "utf8");
const rule = (sel: string) => {
  const m = emergency.match(new RegExp("^\\" + sel + "\\s*\\{([^}]*)\\}", "m"));
  if (!m) throw new Error("rule missing " + sel);
  return m[1];
};
const prop = (body: string, name: string) => {
  const h = body.match(new RegExp("(?:^|[; ])" + name + ":\\s*(#[0-9a-f]{3,6})\\b", "i"))?.[1];
  return h && h.length === 4 ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h;
};

describe("emergency fixed colours", () => {
  it.each([[".c112"], [".c108"], [".ecard"], [".ebtn"], [".ebtnDark"]])("%s text on its own background is at least 4.5:1", (sel) => {
    const body = rule(sel);
    const fg = prop(body, "color")!;
    const bg = prop(body, "background")!;
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("e-card fact labels read on the white card", () => {
    expect(ratio(prop(rule(".facts dt"), "color")!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it.each([["light", light], ["dark", dark]] as const)("fixed dark text on marker and sea-glass is readable in %s", (_n, t) => {
    expect(ratio("#16130f", t.marker)).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#16130f", t["sea-glass"])).toBeGreaterThanOrEqual(4.5);
  });
  it("no emergency rule forces a dark theme", () => {
    expect(emergency).not.toMatch(/data-theme|color-scheme|invert\(/);
    expect(readFileSync("src/app/layout.tsx", "utf8")).toMatch(/data-theme="light"/);
  });
});
