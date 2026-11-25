import { expect, test } from "@playwright/test";

// Sign-in showcase (#109): the moving card lanes need a visible pause control, and the headline dots need a 24px hit area.
// The motion setting is pinned: CI browsers can report reduced motion, where the control is correctly hidden.
test.describe("with motion", () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });

  test("pause stops the lanes, and headline dots are 24px targets", async ({ page }) => {
    await page.goto("/signin");
    const lane = page.locator('[class*="lane"]:not([class*="lanes"])').first();
    await expect(lane).toHaveCSS("animation-play-state", "running");
    await page.getByRole("button", { name: "Pause animation" }).click();
    await expect(page.getByRole("button", { name: "Play animation" })).toHaveAttribute("aria-pressed", "true");
    await expect(lane).toHaveCSS("animation-play-state", "paused");

    const dot = page.locator('[class*="headBtn"]').first();
    const box = await dot.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(24);
    expect(box!.width).toBeGreaterThanOrEqual(24);
  });
});

test.describe("with reduced motion", () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });

  test("no pause control, since nothing moves", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.getByText("What you’ll see in a minute")).toBeVisible();
    await expect(page.getByRole("button", { name: /animation/ })).toHaveCount(0);
  });
});
