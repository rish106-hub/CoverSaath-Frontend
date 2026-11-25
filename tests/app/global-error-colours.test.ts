// Row 33 of issue #107: global-error.tsx cannot load CSS, so its literals must equal the light tokens.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const source = readFileSync("src/app/global-error.tsx", "utf8");
const lightBlock = tokens.match(/:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)![1];
const light = (name: string) => lightBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))![1].toLowerCase();

describe("global error colours", () => {
  it.each(["paper", "ink", "graphite", "harbour", "on-harbour"])("uses the light %s value", (name) => {
    expect(source.toLowerCase()).toContain(`"${light(name)}"`);
  });
  it("has no off-token hex left", () => {
    const allowed = new Set(["paper", "ink", "graphite", "harbour", "on-harbour"].map(light));
    const found = (source.match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((h) => h.toLowerCase());
    for (const h of found) expect(allowed.has(h), h).toBe(true);
  });
});
