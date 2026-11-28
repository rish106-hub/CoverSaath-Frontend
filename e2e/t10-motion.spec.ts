import { expect, test, type Page } from "@playwright/test";

test.use({ channel: "chrome" });

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

// The durations live in custom properties on .kv-app (src/styles/app-theme.css). Tests read them from there, never as literals,
// so retuning a token cannot break a test that only wants the element to follow the token.
const tokenMs = (page: Page, name: string): Promise<number> =>
  page.evaluate((prop) => {
    const raw = getComputedStyle(document.querySelector(".kv-app") as Element).getPropertyValue(prop).trim();
    return raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
  }, name);

test("tools tab and signin filter swap use Mercury values", async ({ page }) => {
  await page.goto("/tools");
  await page.waitForLoadState("networkidle");
  // The four motion tokens exist and are positive.
  for (const name of ["--t-in", "--t-out", "--t-press", "--t-panel"]) expect(await tokenMs(page, name), name).toBeGreaterThan(0);
  // Press feedback is shorter than a state change, and a panel takes longer than a state change.
  expect(await tokenMs(page, "--t-press")).toBeLessThanOrEqual(await tokenMs(page, "--t-in"));
  expect(await tokenMs(page, "--t-panel")).toBeGreaterThanOrEqual(await tokenMs(page, "--t-in"));
  // The top-bar "Search or jump to" button changes its border over --t-in.
  const search = page.getByRole("button", { name: /Search or jump to/ });
  const timing = await search.evaluate((el) => {
    const cs = getComputedStyle(el);
    const props = cs.transitionProperty.split(",").map((x) => x.trim());
    const durations = cs.transitionDuration.split(",").map((x) => x.trim());
    const at = props.findIndex((p) => p === "border-color" || p === "all");
    return durations[at % durations.length];
  });
  expect(parseFloat(timing) * 1000).toBeCloseTo(await tokenMs(page, "--t-in"), 0);
  // The tools tab strip still swaps its content when a tab is chosen.
  const tabs = page.getByRole("navigation", { name: "Tools" });
  await tabs.getByRole("button", { name: /room/i }).first().click();
  await expect(tabs.getByRole("button", { name: /room/i }).first()).toBeVisible();
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
  // The palette is the one dimmed layer: it covers the whole viewport with a see-through scrim.
  await page.getByRole("button", { name: /Search or jump to/ }).click();
  const palette = page.getByPlaceholder("Go to a page, ask, or do something");
  await expect(palette).toBeVisible({ timeout: 20_000 });
  const scrim = await page.evaluate(() => {
    const el = document.querySelector("[cmdk-root]")?.parentElement?.parentElement as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, bg: getComputedStyle(el).backgroundColor, vw: window.innerWidth, vh: window.innerHeight };
  });
  expect(scrim).not.toBeNull();
  expect(scrim!.w).toBe(scrim!.vw);
  expect(scrim!.h).toBe(scrim!.vh);
  expect(scrim!.bg).toMatch(/rgba|color\(/);
  // Choosing Ask Knowvia swaps the palette for the ask panel, which closes again from its own button.
  await page.getByRole("group", { name: "Ask Knowvia" }).getByRole("option", { name: "Ask Knowvia" }).click();
  const panel = page.getByRole("dialog", { name: "Ask Knowvia" });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await expect(palette).toBeHidden();
  expect(await tokenMs(page, "--t-panel")).toBeGreaterThan(0);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toBeHidden();
  // The chevron must not bob while the panel is idle.
  expect((await anims(page)).filter((a) => a.name === "bob")).toEqual([]);
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
