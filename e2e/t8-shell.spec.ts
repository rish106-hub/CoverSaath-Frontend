import { expect, test, type Page } from "@playwright/test";

test.use({ channel: "chrome" });

// T8: the shell steps back. A five-place rail, one row of sub-tabs where a place has them, one ask bar fixed under the page (never a floating
// button), and the laptop gate under 1024px. Runs against the mock adapter server started by playwright.config.ts.

const ASK_BAR = "Ask about your cover";

async function railPlaces(page: Page): Promise<string[]> {
  return page.getByRole("navigation", { name: "Knowvia sections" }).getByRole("link").allInnerTexts();
}

// Geometry of the three shell regions in one in-page pass, so a re-render between calls cannot give mixed readings.
async function shellRegions(page: Page) {
  return page.evaluate((barName) => {
    const rect = (el: Element | null) => {
      if (!el) throw new Error("shell region missing");
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    return {
      rail: rect(document.querySelector("#app-sidebar")),
      page: rect(document.querySelector("#main-content")),
      bar: rect(document.querySelector(`form[role="search"][aria-label="${barName}"]`)),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  }, ASK_BAR);
}

test("E1 subtabs shown at 1280 on a page that has them", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/policies");
  const tabs = page.getByTestId("page-subtabs");
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("link", { name: "All policies" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Compare" })).toBeVisible();
  // Home has no sub-tabs, so the row is not drawn there.
  await page.goto("/home");
  await expect(page.getByRole("navigation", { name: "Knowvia sections" })).toBeVisible();
  await expect(page.getByTestId("page-subtabs")).toHaveCount(0);
});

test("under 1024px the app shows the open on a laptop screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/home");
  const gate = page.getByTestId("viewport-gate");
  await expect(gate).toBeVisible();
  await expect(gate.getByRole("heading", { name: "Open Knowvia on a laptop.", level: 1 })).toBeVisible();
  await expect(gate.getByText("Sign in there with the same account. Your cover is waiting.")).toBeVisible();
  // The shell is replaced, not squeezed in: no rail and no ask bar on screen.
  await expect(page.getByRole("navigation", { name: "Knowvia sections" })).toBeHidden();
  await expect(page.getByRole("search", { name: ASK_BAR })).toBeHidden();
  // Back at laptop width the app returns and the gate goes.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(gate).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Knowvia sections" })).toBeVisible();
});

test("E5 ask bar hidden on chat", async ({ page }) => {
  // The ask bar is not drawn on /chat (the assistant itself) or on /emergency; everywhere else in the shell it is.
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("search", { name: ASK_BAR })).toHaveCount(0);
  await page.goto("/home");
  await expect(page.getByRole("search", { name: ASK_BAR })).toBeVisible();
});

test("E6 ask bar geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/home");
  await expect(page.getByRole("search", { name: ASK_BAR })).toBeVisible();
  const r = await shellRegions(page);
  // Inside the page column: right of the rail, inside the viewport, and below the page content.
  expect(r.bar.left).toBeGreaterThanOrEqual(r.rail.right);
  expect(r.bar.right).toBeLessThanOrEqual(r.viewport.width);
  expect(r.bar.bottom).toBeLessThanOrEqual(r.viewport.height);
  expect(r.bar.top).toBeGreaterThanOrEqual(r.page.bottom);
  // The rail and the bar share no horizontal space.
  expect(r.rail.right).toBeLessThanOrEqual(r.bar.left);
});

test("E7 no overlap 1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/home");
  expect(await railPlaces(page)).toEqual(["Home", "My policies", "Ask", "Family", "Money"]);
  for (const route of ["/home", "/tools", "/policies"]) {
    await page.goto(route);
    await expect(page.getByRole("search", { name: ASK_BAR })).toBeVisible();
    // There is no floating Ask button any more; the bar is the one ask control.
    await expect(page.getByTestId("ask-fab")).toHaveCount(0);
    const r = await shellRegions(page);
    expect(r.page.bottom, `${route} page ends above the ask bar`).toBeLessThanOrEqual(r.bar.top);
    expect(r.rail.right, `${route} rail ends before the ask bar`).toBeLessThanOrEqual(r.bar.left);
    // Sub-tabs sit in the top bar, above the page, on the places that have them.
    const tabs = page.getByTestId("page-subtabs");
    if (await tabs.count()) {
      const box = (await tabs.boundingBox()) as { y: number; height: number };
      expect(box.y + box.height, `${route} sub-tabs above the page`).toBeLessThanOrEqual(r.page.top + 1);
    }
  }
});

test("E9 bottom padding", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/home");
  const main = page.locator("#main-content");
  await expect(main).toBeVisible();
  const r = await shellRegions(page);
  // Only the page scrolls. Content keeps arriving after first paint, so scroll to the end on every poll: once the page has settled, its last block must clear the ask bar.
  await expect
    .poll(async () => main.evaluate((el) => { el.scrollTop = el.scrollHeight; return ((el.lastElementChild as HTMLElement | null) ?? el).getBoundingClientRect().bottom; }))
    .toBeLessThanOrEqual(r.bar.top);
  expect(r.bar.bottom).toBeLessThanOrEqual(r.viewport.height);
});
