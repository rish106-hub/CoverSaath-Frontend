import { expect, test } from "@playwright/test";

// Sign-in showcase (#109): the moving card lanes need a visible pause control, and the headline dots need a 24px hit area.
test.use({ viewport: { width: 1280, height: 900 } });

test("pause stops the lanes, and headline dots are 24px targets", async ({ page }) => {
  await page.goto("/signin");
  const lane = page.locator('[class*="lane"]:not([class*="lanes"])').first();
  await expect(lane).toHaveCSS("animation-play-state", "running");
  const toggle = page.getByRole("button", { name: "Pause animation" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Play animation" })).toHaveAttribute("aria-pressed", "true");
  await expect(lane).toHaveCSS("animation-play-state", "paused");

  const dot = page.locator('[class*="headBtn"]').first();
  const box = await dot.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);
  expect(box!.width).toBeGreaterThanOrEqual(24);
});
