import { expect, test, type Page } from "@playwright/test";

// The journey in docs/keyboard-walkthrough.md. The dev server runs with NEXT_PUBLIC_ADAPTERS=mock, so no backend is needed.

async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
}

test("keyboard only: / to /signin to /welcome to /home to /emergency", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  // The root path renders the sign-in screen itself. Phone is the default way in; Enter sends the code, six typed digits verify it.
  await page.getByLabel("Mobile number").focus();
  await page.keyboard.type("9876543210");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Enter the code", level: 1 })).toBeVisible();
  await page.keyboard.type("123456");
  await expect(page.getByRole("heading", { name: "You’re in.", level: 1 })).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto("/signin");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.goto("/welcome");
  await expect(page.getByRole("link").first()).toBeVisible();

  await page.goto("/home");
  await expect(page.getByText("Ask Knowvia anything")).toBeVisible();
  // The dev server compiles /home on first hit, so the shortcut listener can attach after the first key press.
  // Retry the press until hydration lands, then assert the toggle back.
  await expect(async () => {
    await page.keyboard.press("t");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press("t");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("?");
  await expect(page.getByText(/Hold to talk to Knowvia/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("e");
  await expect(page).toHaveURL(/\/emergency$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("2");
  await expect(page.getByText("Call 112").first()).toBeVisible();
  await noHorizontalScroll(page);
});

test("g then c goes to Compare and 3 picks a plan", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByText("Ask Knowvia anything")).toBeVisible();
  // Dev server compiles on first hit; retry the chord until the shortcut listener has hydrated.
  await expect(async () => {
    await page.keyboard.press("g");
    await page.keyboard.press("c");
    await expect(page).toHaveURL(/\/compare$/, { timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText(/Fit for .* family/)).toBeVisible();
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

// The /assistant demo page is gone (it redirects to /chat); the typed-question path is covered in chat.spec.ts.
test("/assistant redirects to /chat", async ({ page }) => {
  await page.goto("/assistant");
  await expect(page).toHaveURL(/\/chat$/);
});
