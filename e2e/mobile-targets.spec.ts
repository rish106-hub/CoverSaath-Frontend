import { expect, test } from "@playwright/test";

// #84: on a touch phone the shared controls reach 44px, the sign-in tiles stack, the welcome page keeps a 16px gutter,
// and the /home greeting (the LCP element) paints with no entrance animation.
// Runs against the mock-adapter dev server from playwright.config.ts.

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test("/home greeting has no entrance animation and the small button is 44px", async ({ page }) => {
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  const h1 = page.getByRole("heading", { level: 1 }).first();
  const animation = await h1.evaluate((el) => {
    const block = el.parentElement!;
    return getComputedStyle(block).animationName;
  });
  expect(animation).toBe("none");
  const small = page.locator(".k-btn--sm").first();
  if (await small.count()) expect((await small.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

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

test("/signin tiles stack in one column", async ({ page }) => {
  await page.goto("/signin");
  await page.waitForLoadState("networkidle");
  const cols = await page.locator('[class*="whys"]').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(cols).toBe(1);
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
