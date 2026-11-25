import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/components/public/signin.module.css", "utf8");
const rule = (sel: string) => css.split("\n").find((l) => l.startsWith(`${sel} {`)) ?? "";

describe("sign-in carousel CSS (#109)", () => {
  it("gives each headline dot a 24px hit area and draws only the dot at 8px", () => {
    expect(rule(".headBtn")).toMatch(/min-width: 24px; height: 24px/);
    expect(rule(".headDot")).toMatch(/width: 8px; height: 8px/);
  });
  it("colours dots from tokens only", () => {
    expect(rule(".headDot") + rule(".headDotOn")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
  it("pauses lane animation when the pause control is on", () => {
    expect(css).toMatch(/\.lanesPaused \.lane \{ animation-play-state: paused/);
  });
});
