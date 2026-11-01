import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith(".css") ? [p] : [];
  });
}

const BUTTONISH = /(btn|button|cta|chip|pill|tab|big)/i;
// Round on purpose: switch tracks and knobs, dots, avatars, orbs, progress bars, status tags.
const ALLOW = /(\bsw\b|switch|knob|dot|avatar|orb|tickbig|tag|badge|bar|heads|swatch|table|state|status|beta|count|kind|verdict|ring|donut)/i;

describe("boxy buttons", () => {
  const tokens = readFileSync("src/styles/tokens.css", "utf8");
  it("defines the button tokens", () => {
    for (const t of ["--r-btn: 8px", "--r-btn-sm: 6px", "--btn-h: 44px", "--btn-h-sm: 36px"]) expect(tokens).toContain(t);
  });

  it("no button-like selector is pill, circle or large-radius", () => {
    const bad: string[] = [];
    for (const f of cssFiles("src")) {
      const css = readFileSync(f, "utf8");
      for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
        const rad = m[2].match(/border-radius:\s*([^;]+)/)?.[1].trim();
        if (!rad) continue;
        const px = /^(\d+)px$/.exec(rad);
        const big = rad === "50%" || (px && Number(px[1]) >= 16) || rad === "var(--r-lg)" || rad === "var(--r-xl)";
        if (!big) continue;
        for (const sel of m[1].split(",").map((s) => s.trim())) {
          if (BUTTONISH.test(sel) && !ALLOW.test(sel)) bad.push(`${f}: ${sel} -> ${rad}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
