import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { analyze, BUDGET_KB } from "../scripts/analyze-size.mjs";

const dist = path.resolve(__dirname, "..", ".next");

// Needs a finished `npm run build`; without one there is nothing to measure, so the test says so and passes.
describe.skipIf(!existsSync(path.join(dist, "BUILD_ID")))("first-load JS budget", () => {
  it(`no route exceeds ${BUDGET_KB} kB gzip`, () => {
    const rows = analyze(dist) as { route: string; kb: number }[];
    console.log(rows.map((r) => `${r.kb} kB ${r.route}`).join("\n"));
    expect(rows.length).toBeGreaterThan(10);
    const over = rows.filter((r) => r.kb > BUDGET_KB);
    expect(over, `over budget: ${JSON.stringify(over)}`).toEqual([]);
  });
});
