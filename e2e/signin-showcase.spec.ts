import { expect, test, type Page } from "@playwright/test";

// Sign-in showcase (#109): the moving card lanes need a visible pause control, and the headline dots need a 24px hit area.
// Motion and device capacity are pinned: CI runners have few cores, which the app treats as reduced motion.
const lanes = (page: Page) => page.locator('[class*="lane"]:not([class*="lanes"])').first();
const device = (page: Page, cores: number, memoryGb: number) =>
  page.addInitScript(([c, m]) => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => c });
    Object.defineProperty(navigator, "deviceMemory", { get: () => m });
  }, [cores, memoryGb]);

test.describe("with motion", () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });

  test("pause stops the lanes, and headline dots are 24px targets", async ({ page }) => {
    await device(page, 8, 8);
    await page.goto("/signin");
    await expect(lanes(page)).toHaveCSS("animation-play-state", "running");
    await page.getByRole("button", { name: "Pause animation" }).click();
    await expect(page.getByRole("button", { name: "Play animation" })).toHaveAttribute("aria-pressed", "true");
    await expect(lanes(page)).toHaveCSS("animation-play-state", "paused");

    const box = await page.locator('[class*="headBtn"]').first().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(24);
    expect(box!.width).toBeGreaterThanOrEqual(24);
  });

  test("a low-capacity device gets still lanes and no control", async ({ page }) => {
    await device(page, 2, 2);
    await page.goto("/signin");
    await expect(page.getByText("What you’ll see in a minute")).toBeVisible();
    await expect(lanes(page)).toHaveCSS("animation-play-state", "paused");
    await expect(page.getByRole("button", { name: /animation/ })).toHaveCount(0);
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
