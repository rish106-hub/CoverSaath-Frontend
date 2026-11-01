import { expect, test, type Page } from "@playwright/test";

// The journey in docs/keyboard-walkthrough.md. The dev server runs with NEXT_PUBLIC_ADAPTERS=mock, so no backend is needed.

async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
}

test("keyboard only: / to /signin to /welcome to /home to /emergency", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /get access/i })).toBeVisible();
  await page.getByLabel(/name/i).first().focus();
  await page.keyboard.type("Meera Rao");
  await page.keyboard.press("Tab");
  await page.keyboard.type("meera.rao@company.com");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/You.re in, Meera/)).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto("/signin");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.goto("/welcome");
  await expect(page.getByRole("link").first()).toBeVisible();

  await page.goto("/home");
  await expect(page.getByText("Ask Knowvia anything")).toBeVisible();
  await page.keyboard.press("t");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("t");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("?");
  await expect(page.getByText(/Hold to talk to Knowvia/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("e");
  await expect(page).toHaveURL(/\/emergency$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("2");
  await expect(page.getByText("Call 112")).toBeVisible();
  await noHorizontalScroll(page);
});

test("g then c goes to Compare and 3 picks a plan", async ({ page }) => {
  await page.goto("/home");
  await page.keyboard.press("g");
  await page.keyboard.press("c");
  await expect(page).toHaveURL(/\/compare$/);
  await page.keyboard.press("3");
  await expect(page.getByText(/Keep your group plan and add Meridian Care/)).toBeVisible();
});

test("mouse only: sidebar to Emergency, Show QR", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("link", { name: /emergency/i }).first().click();
  await expect(page).toHaveURL(/\/emergency$/);
  await page.getByRole("button", { name: "Show QR" }).click();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
});

test("voice path: Ask Knowvia card answers a typed phrase (no microphone in CI)", async ({ page }) => {
  await page.goto("/assistant");
  await page.getByRole("button", { name: "How much tax can I save this year?" }).click();
  await expect(page.getByText(/Rs 75,000/).first()).toBeVisible();
});
