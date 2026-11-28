import { expect, test } from "@playwright/test";

// #84: on a touch phone the shared controls reach 44px, the welcome page keeps a 16px gutter and a long title stays inside the viewport.
// Runs against the mock-adapter dev server from playwright.config.ts.

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test("sidebar-free pages: theme and mic icon buttons are at least 44px", async ({ page }) => {
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  for (const name of [/theme/i, /voice|microphone|mic/i]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.count()) {
      const box = (await btn.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("/welcome keeps a 16px gutter", async ({ page }) => {
  await page.goto("/welcome");
  await page.waitForLoadState("networkidle");
  const left = await page.locator("main").first().evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
  expect(left).toBe(16);
});

test("long title wraps inside the viewport on /policies", async ({ page }) => {
  await page.goto("/policies");
  await page.waitForLoadState("networkidle");
  const { w, c } = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  expect(w).toBeLessThanOrEqual(c);
});
