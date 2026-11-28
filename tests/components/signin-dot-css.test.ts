import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/components/public/signin.module.css", "utf8");

// The headline dots and the pause control left with the showcase (spec R6a); what stays is that the page moves nothing on its own.
describe("sign-in opening page CSS (#109, R6a)", () => {
  it("has no carousel dots, lanes or looping animation left", () => {
    expect(css).not.toMatch(/headBtn|headDot|\.lanes|@keyframes|animation:/);
  });
  it("colours everything from tokens only", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
