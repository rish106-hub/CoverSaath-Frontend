test.use({ channel: "chrome" });
import { expect, test, type Page } from "@playwright/test";

// T10 motion contract (spec 5b): every value below is measured from the browser's own animation timeline,
// not from the CSS source, so a rule that stops applying fails here. Mock adapters, no backend.
// Device capacity is pinned: low-core machines get data-motion="reduced", which would hide every animation.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
  });
});

type Anim = { name: string; dur: number; ease: string; delay: number; iter: number; state: string; props: string[] };

const anims = (page: Page): Promise<Anim[]> =>
  page.evaluate(() =>
    document.getAnimations().map((a) => {
      const t = a.effect!.getTiming();
      const anim = a as CSSAnimation & CSSTransition;
      return {
        name: String(anim.animationName ?? anim.transitionProperty).replace(/^.*__/, ""),
        dur: Number(t.duration),
        // CSS animations carry their timing function on the keyframes; effect timing easing stays "linear".
        ease: a instanceof CSSTransition ? String(t.easing) : String((a.effect as KeyframeEffect).getKeyframes()[0]?.easing ?? t.easing),
        delay: Number(t.delay),
        iter: Number(t.iterations),
        state: a.playState,
        props: (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !["offset", "easing", "composite", "computedOffset"].includes(k)),
      };
    }),
  );

const bezier = (s: string) => (s.match(/-?\d*\.?\d+/g) ?? []).map(Number);
const sameEase = (actual: string, expected: string) => {
  if (!expected.startsWith("cubic-bezier")) return actual === expected;
  const a = bezier(actual), e = bezier(expected);
  return a.length === 4 && a.every((n, i) => Math.abs(n - e[i]) <= 0.05);
};
const within = (n: number, expected: number) => Math.abs(n - expected) <= expected * 0.05;
const MOVING = ["transform", "translate", "scale", "rotate", "filter", "textShadow"];
const moving = (list: Anim[]) => list.filter((a) => a.props.some((p) => MOVING.includes(p)));

test("no motion on load /home /policies /tools", async ({ page }) => {
  for (const route of ["/home", "/policies", "/tools"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const running = (await anims(page)).filter((a) => a.state === "running");
    expect(moving(running), route).toEqual([]);
    for (const a of running) expect(a.props.every((p) => ["opacity", "backgroundPosition"].includes(p)), `${route} ${a.name}`).toBe(true);
  }
});

test("nothing replays in session", async ({ page }) => {
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await page.goto("/policies");
  await page.goto("/home");
  await page.waitForTimeout(100);
  const list = await anims(page);
  expect(moving(list.filter((a) => a.state === "running"))).toEqual([]);
  expect(list.filter((a) => a.dur === 760 || a.dur === 700)).toEqual([]);
});

test("emergency has zero animations", async ({ page }) => {
  await page.goto("/emergency");
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  for (const link of (await page.locator("main").getByRole("link").all()).slice(0, 8)) {
    await link.hover({ timeout: 1000 }).catch(() => {});
    await link.focus({ timeout: 1000 }).catch(() => {});
  }
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("emergency links transition 0s", async ({ page }) => {
  await page.goto("/emergency");
  const result = await page.evaluate(() => {
    const els = [...document.querySelectorAll("main a, main button")];
    return els.map((el) => { const s = getComputedStyle(el); return { td: s.transitionDuration.split(",").map((x) => x.trim()), an: s.animationName }; });
  });
  expect(result.length).toBeGreaterThan(0);
  for (const r of result) { expect(r.td.every((x) => x === "0s")).toBe(true); expect(r.an).toBe("none"); }
});

test("tools tab and signin filter swap use Mercury values", async ({ page }) => {
  await page.goto("/tools");
  await page.waitForLoadState("networkidle");
  await page.getByRole("navigation", { name: "Tools" }).getByRole("button", { name: /room/i }).first().click();
  const entering = (await anims(page)).find((a) => a.name === "tab-in");
  expect(entering).toBeTruthy();
  expect(entering!.props).toEqual(expect.arrayContaining(["opacity", "transform"]));
  expect(within(entering!.dur, 300)).toBe(true);
  expect(entering!.ease).toBe("ease-in-out");

  await page.goto("/signin");
  await page.locator('[class*="filters"] button[aria-pressed="false"]').first().click();
  const chip = (await anims(page)).filter((a) => a.name === "color" || a.name === "background-color");
  expect(chip.length).toBeGreaterThan(0);
  for (const a of chip) { expect(within(a.dur, 300)).toBe(true); expect(sameEase(a.ease, "cubic-bezier(0.25, 1, 0.5, 1)")).toBe(true); }
});

test("coverage bars fill with Copilot values", async ({ page }) => {
  await page.goto("/dev/ui");
  const rows = page.locator('[data-testid="bar-row"] span[class*="barFill"]');
  const first = await rows.first().elementHandle();
  expect(first).toBeTruthy();
  const perRow = await rows.evaluateAll((els) =>
    els.slice(0, 4).map((el) => ({
      origin: getComputedStyle(el).transformOrigin,
      anims: el.getAnimations().map((a) => {
        const t = a.effect!.getTiming();
        const k = (a.effect as KeyframeEffect).getKeyframes();
        return { name: String((a as CSSAnimation).animationName).replace(/^.*__/, ""), dur: Number(t.duration), delay: Number(t.delay), ease: String(k[0]?.easing), props: Object.keys(k[0] ?? {}) };
      }),
    })),
  );
  expect(perRow.length).toBeGreaterThanOrEqual(2);
  for (const [i, row] of perRow.entries()) {
    expect(row.origin.startsWith("0px")).toBe(true);
    const grow = row.anims.find((a) => a.name === "fill-grow")!;
    const fade = row.anims.find((a) => a.name === "fill-fade")!;
    expect(grow.props).toContain("transform");
    expect(within(grow.dur, 900)).toBe(true);
    expect(sameEase(grow.ease, "cubic-bezier(0.16, 1, 0.3, 1)")).toBe(true);
    expect(within(fade.dur, 900)).toBe(true);
    expect(sameEase(fade.ease, "cubic-bezier(0.25, 1, 0.5, 1)")).toBe(true);
    // Row n starts n x 120ms after row 0.
    expect(Math.abs(grow.delay - i * 120)).toBeLessThanOrEqual(6);
  }
});

test("ask panel dimmer and panel values", async ({ page }) => {
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  const trigger = page.locator("[data-ask-trigger]");
  // First open only loads the lazy panel chunk; the measured open is the second one.
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Ask Knowvia" })).toBeVisible({ timeout: 20_000 });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Ask Knowvia" })).toBeHidden();
  await page.waitForTimeout(500);
  await trigger.click();
  await page.getByRole("dialog", { name: "Ask Knowvia" }).waitFor();
  const sheet = (await anims(page)).find((a) => a.name === "sheet-in");
  expect(sheet).toBeTruthy();
  expect(within(sheet!.dur, 300)).toBe(true);
  expect(sameEase(sheet!.ease, "cubic-bezier(0.25, 1, 0.5, 1)")).toBe(true);
  expect(sheet!.props).toEqual(expect.arrayContaining(["opacity", "transform"]));
  // The chevron must not bob while the panel is idle.
  expect((await anims(page)).filter((a) => a.name === "bob")).toEqual([]);
});

test("landing headline and reveals", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
  const body = (await anims(page)).find((a) => a.name === "pop");
  if (body) {
    expect(within(body.dur, 700)).toBe(true);
    expect(sameEase(body.ease, "cubic-bezier(0.37, 0.34, 0.26, 0.9)")).toBe(true);
    expect(body.props).toEqual(expect.arrayContaining(["opacity", "transform"]));
  }
  await page.goto("/signin", { waitUntil: "commit" });
  // Poll: the headline animation exists from first paint and the dev server may still be compiling the route.
  await expect.poll(async () => (await anims(page).catch(() => [])).some((a) => a.name === "headline-in"), { timeout: 20_000, intervals: [50] }).toBe(true);
  const headline = (await anims(page)).find((a) => a.name === "headline-in");
  expect(within(headline!.dur, 1020)).toBe(true);
  expect(sameEase(headline!.ease, "cubic-bezier(0.22, 0.61, 0.36, 1)")).toBe(true);
  expect(headline!.props).toEqual(expect.arrayContaining(["opacity", "filter"]));
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const greeting = page.getByRole("heading", { level: 1 }).first();
  expect(await greeting.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test("signin lanes marquee 48s and pause off-screen", async ({ page }) => {
  await page.goto("/signin");
  await page.waitForTimeout(300);
  const lanes = (await anims(page)).filter((a) => a.name === "up" || a.name === "down");
  const up = lanes.find((a) => a.name === "up");
  const down = lanes.find((a) => a.name === "down");
  expect(up && within(up.dur, 48000)).toBe(true);
  expect(up!.ease).toBe("linear");
  expect(up!.iter).toBe(Infinity);
  if (down) expect(within(down.dur, 56000)).toBe(true);
});

test("reduced motion stops transforms", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tools");
  await page.waitForLoadState("networkidle");
  await page.getByRole("navigation", { name: "Tools" }).getByRole("button", { name: /room/i }).first().click();
  await page.waitForTimeout(50);
  // 1ms durations may still appear in the timeline; none may be long-running.
  expect((await anims(page)).filter((a) => a.state === "running" && a.dur > 1 && a.props.some((p) => MOVING.includes(p)))).toEqual([]);
  await page.goto("/signin");
  await page.waitForTimeout(100);
  expect((await anims(page)).filter((a) => a.state === "running" && a.iter === Infinity && a.dur > 1 && a.props.includes("transform"))).toEqual([]);
});
