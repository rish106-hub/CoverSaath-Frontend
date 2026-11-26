import { expect, test } from "@playwright/test";

test.use({ channel: "chrome" });

// T9: no dead-end routes. Runs against the mock-adapter dev server (playwright.config.ts).

test("covers redirects to policies", async ({ page }) => {
  const resp = await page.goto("/covers");
  await expect(page).toHaveURL(/\/policies$/);
  expect(resp!.status()).toBe(200);
});

for (const [name, path] of [["contact", "/contact"], ["privacy", "/privacy"], ["terms", "/terms"]] as const) {
  test(`${name} in public frame`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("header a[href='/']").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Back", exact: true })).toHaveAttribute("href", "/");
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(1);
  });
}

test("back link goes home", async ({ page }) => {
  for (const path of ["/contact", "/privacy", "/terms"]) {
    await page.goto(path);
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test("welcome has three steps", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: /^You[’']re in, .+\.$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "1. Add your policy" })).toHaveAttribute("href", "/covers/add");
  await expect(page.getByRole("link", { name: "2. Add your family" })).toHaveAttribute("href", "/family");
  await expect(page.getByRole("link", { name: "3. See what you'd pay" })).toHaveAttribute("href", "/stress-test");
  await expect(page.getByRole("main").getByRole("link")).toHaveCount(3);
  await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
});

test("routes 200 under 3s", async ({ page }) => {
  for (const path of ["/covers", "/contact", "/privacy", "/terms", "/welcome", "/policies"]) {
    const start = Date.now();
    const response = await page.request.get(path);
    expect(Date.now() - start, path).toBeLessThan(3000);
    expect(response.status(), path).toBe(200);
  }
});
