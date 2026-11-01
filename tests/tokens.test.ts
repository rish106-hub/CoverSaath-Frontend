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
  ["g-cover", "sheet"], ["g-family", "sheet"], ["g-money", "sheet"], ["g-help", "sheet"],
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
