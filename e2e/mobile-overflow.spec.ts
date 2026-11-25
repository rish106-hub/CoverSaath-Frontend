import { expect, test } from "@playwright/test";

// Phones are most of the traffic: the public routes and the first app routes must fit a 375px viewport with no sideways scroll,
// and /home must not shift while the session loads (the app grid used to stretch its top bar row until content arrived).
// Runs against the mock-adapter dev server from playwright.config.ts.

test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

for (const route of ["/", "/signin", "/welcome", "/home", "/policies"]) {
  test(`no horizontal scroll at 375px on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

test("/home does not shift while the session loads", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.1);
});
