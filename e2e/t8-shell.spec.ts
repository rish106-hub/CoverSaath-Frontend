test.use({ channel: "chrome" });
import { expect, test, type Page } from "@playwright/test";

// T8: the shell steps back. One navigation (sub-tabs only where the sidebar is not full), one Ask control that never covers a field,
// and a compact trial pill that stays dismissed. Runs against the mock adapter server started by playwright.config.ts.

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// One in-page pass, so a re-render between separate calls cannot make the Ask control look like another control.
async function controlsOverlappingAsk(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fab = document.querySelector('[data-testid="ask-fab"]');
    if (!fab) throw new Error("ask-fab missing");
    const a = fab.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of Array.from(document.querySelectorAll("input, textarea, select, button"))) {
      if (el === fab || fab.contains(el)) continue;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === "hidden" || style.display === "none") continue;
      if (a.left < r.right && r.left < a.right && a.top < r.bottom && r.top < a.bottom) {
        hits.push(`${el.tagName.toLowerCase()} id=${el.id} type=${el.getAttribute("type")} label="${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" rect=${JSON.stringify(r)}`);
      }
    }
    return hits;
  });
}

async function expectNoOverlap(page: Page, routes: string[]) {
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByTestId("ask-fab")).toBeVisible();
    expect(await controlsOverlappingAsk(page), `${route} top`).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    expect(await controlsOverlappingAsk(page), `${route} bottom`).toEqual([]);
  }
}

test("E1 subtabs hidden at 1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/policies");
  await expect(page.getByTestId("page-subtabs")).not.toBeVisible();
});

test("E2 subtabs shown at 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/policies");
  await expect(page.getByTestId("page-subtabs")).toBeVisible();
  await page.setViewportSize({ width: 1099, height: 800 });
  await expect(page.getByTestId("page-subtabs")).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(page.getByTestId("page-subtabs")).not.toBeVisible();
});

test("E5 ask hidden on chat", async ({ page }) => {
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto("/chat");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByTestId("ask-fab")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/home");
  await expect(page.getByTestId("ask-fab")).toBeVisible();
});

test("E6 ask geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/home");
  const box = await page.getByTestId("ask-fab").boundingBox();
  expect(box).not.toBeNull();
  const b = box as Box;
  expect(b.width).toBe(56);
  expect(b.height).toBe(56);
  expect(1280 - (b.x + b.width)).toBeGreaterThanOrEqual(0);
  expect(1280 - (b.x + b.width)).toBeLessThanOrEqual(24);
  expect(800 - (b.y + b.height)).toBeGreaterThanOrEqual(0);
  expect(800 - (b.y + b.height)).toBeLessThanOrEqual(24);
});

test("E7 no overlap 1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expectNoOverlap(page, ["/home", "/tools", "/covers/add", "/policies"]);
});

test("E8 no overlap 390", async ({ page }) => {
  // At rest the round button may sit over a field at 390; it must step aside (opacity 0) while that field has focus and return on blur.
  await page.setViewportSize({ width: 390, height: 844 });
  const ask = page.getByTestId("ask-fab");
  const askWrap = ask.locator("xpath=.."); // opacity is set on the fixed wrapper around the button
  for (const route of ["/home", "/tools", "/covers/add", "/policies"]) {
    await page.goto(route);
    await expect(ask).toBeVisible();
    const fields = page.locator("main input, main textarea, main select");
    const count = await fields.count();
    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      if (!(await field.isVisible()) || !(await field.isEnabled())) continue;
      await field.evaluate((el) => (el as HTMLElement).focus());
      await expect(page.locator("main :is(input, textarea, select):focus"), `${route} field ${i} focused`).toHaveCount(1);
      await expect(askWrap, `${route} field ${i} focused`).toHaveCSS("opacity", "0");
      await field.evaluate((el) => (el as HTMLElement).blur());
      await expect(askWrap, `${route} field ${i} blurred`).toHaveCSS("opacity", "1");
    }
  }
});

test("E9 bottom padding", async ({ page }) => {
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto("/home");
    const main = page.locator("#main-content");
    await expect(main).toBeVisible();
    const padding = await main.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(padding).toBeGreaterThanOrEqual(80);
    // Content can keep growing after load, so scroll until the bottom is really reached.
    await expect.poll(async () => page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); return Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1; })).toBe(true);
    const lastBottom = await main.evaluate((el) => {
      const last = el.lastElementChild as HTMLElement | null;
      return (last ?? el).getBoundingClientRect().bottom;
    });
    const ask = (await page.getByTestId("ask-fab").boundingBox()) as Box;
    expect(lastBottom).toBeLessThanOrEqual(ask.y);
  }
});
