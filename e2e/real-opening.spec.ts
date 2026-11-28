import { expect, test } from "@playwright/test";
import { expectCalm, shot, SIZES } from "./real-calm";

// The opening page (/ and /signin) in a real browser on a dev server in backend mode (spec R6a.4). No session cookie is set and
// asRealAccount is not used: this is what a first-time visitor sees. Run with playwright.real.config.ts (own port).
// Synthetic data only. Requests to any host other than the dev server are aborted, as in real-account.ts, so no real address is contacted.

const PUNCH_LINE = "Health cover, finally clear.";

test.beforeEach(async ({ page, baseURL }) => {
  const baseHost = new URL(baseURL ?? "http://localhost").host;
  await page.route((url) => url.host !== baseHost && !/^(data|blob):/.test(url.protocol), (route) => route.abort());
});

test("the opening page shows the punch line, the sign-in form and the photograph", async ({ page }) => {
  await page.goto("/signin");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(PUNCH_LINE);
  expect((await heading.innerText()).trim().split(/\s+/).length).toBeLessThanOrEqual(5);
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  const photo = page.locator('img[src*="family.jpg"]');
  await expect(photo).toHaveCount(1);
  await expect.poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const box = await photo.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.x >= viewport.width / 2 - 1).toBe(true);
});

test("the opening page is calm at every laptop size", async ({ page }) => {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/signin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PUNCH_LINE);
    await expect.poll(() => page.locator('img[src*="family.jpg"]').evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expectCalm(page, "opening");
    await shot(page, "opening");
  }
});

test("the root path shows the same opening page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PUNCH_LINE);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("no beta, trial or showcase text is on the opening page", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PUNCH_LINE);
  const text = await page.locator("body").innerText();
  for (const banned of ["Private beta", "Trial", "Get access", "What you’ll see", "Beta"]) expect(text).not.toContain(banned);
});
