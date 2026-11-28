import { expect, test, type Page } from "@playwright/test";
import { asRealAccount } from "./real-account";
import { expectCalm, expectNoFindings, expectNothingCutOff, shot, SIZES, type Sink } from "./real-calm";

// Compare, stress test and hospitals for a real account in a real browser, on the dev server in backend mode with no backend behind it
// (asRealAccount answers every /api/app/* call with synthetic data and sets the plain session cookie the proxy looks for, as
// real-screens.spec.ts does). Run with playwright.real.config.ts. A rule the product breaks is a finding, never loosened here.

const SHORT_VIEWPORT = { width: 1280, height: 560 } as const;

/**
 * Lets the fit hook finish: a list first renders its maximum rows, the browser then reports the real box height and the list re-renders with
 * the rows that fit. Measuring in that gap would judge a frame no person sees for longer than a blink, so wait for a few frames first.
 */
const settle = (page: Page) => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 100))))));

test("compare shows both policies and hides equal rows with Only what differs", async ({ page }) => {
  await asRealAccount(page);
  await page.goto("/compare");
  const table = page.getByTestId("compare-table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Example Health Plan 01/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Example Family Floater 02/ })).toBeVisible();
  // Both fixture policies have a Rs 5,00,000 sum insured, so that row is equal until Only what differs hides it.
  await expect(table.getByRole("rowheader", { name: "Sum insured" })).toBeVisible();
  await expect(table.locator('[role="row"][data-same="true"]').first()).toBeVisible();
  await page.getByRole("switch", { name: "Only what differs" }).click();
  await expect(table.locator('[role="row"][data-same="true"]')).toHaveCount(0);
  await expect(table.getByRole("rowheader", { name: "Sum insured" })).toHaveCount(0);
  await expect(table.locator('[role="row"][data-same="false"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Run a hospital bill through them" })).toHaveAttribute("href", "/stress-test");
  await shot(page, "compare");
});

test("compare is calm at every laptop size", async ({ page }) => {
  await asRealAccount(page);
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/compare");
    await expect(page.getByTestId("compare-table")).toBeVisible();
    await settle(page);
    await expectCalm(page, "compare", found);
    await shot(page, "compare");
  }
  expectNoFindings(found, "compare breaks calm rules");
});

test("compare with one policy asks for another", async ({ page }) => {
  await asRealAccount(page, { policies: 1 });
  await page.goto("/compare");
  await expect(page.getByRole("heading", { name: "You have one policy. Add another to see them side by side." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add a policy" }).first()).toHaveAttribute("href", "/covers/add");
  await expect(page.getByTestId("compare-table")).toHaveCount(0);
});

test("stress test shows what you pay for a typed bill and turns red past the sum insured", async ({ page }) => {
  await asRealAccount(page);
  await page.goto("/stress-test");
  const bill = page.getByLabel("Hospital bill, in rupees");
  await expect(page.getByTestId("you-pay")).toHaveText("Rs 0");
  await bill.fill("300000");
  await expect(bill).toHaveValue("3,00,000");
  // Policy 1: sum insured Rs 5,00,000 and a 10% co-pay, so Rs 30,000 of a Rs 3,00,000 bill is the person's.
  await expect(page.getByTestId("you-pay")).toHaveText("Rs 30,000");
  await expect(page.getByTestId("you-pay")).toHaveAttribute("data-over", "false");
  await expect(page.getByTestId("stress-result")).toContainText("Within your sum insured of Rs 5,00,000.");
  await page.getByRole("button", { name: "Rs 15,00,000" }).click();
  await expect(bill).toHaveValue("15,00,000");
  await expect(page.getByTestId("you-pay")).toHaveAttribute("data-over", "true");
  await expect(page.getByTestId("stress-result")).toContainText("The bill goes past your sum insured of Rs 5,00,000.");
  await shot(page, "stress");
});

test("stress test is calm at every laptop size", async ({ page }) => {
  await asRealAccount(page);
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/stress-test");
    await page.getByLabel("Hospital bill, in rupees").fill("1500000");
    await expect(page.getByTestId("you-pay")).toHaveAttribute("data-over", "true");
    await settle(page);
    await expectCalm(page, "stress", found);
    await shot(page, "stress");
  }
  expectNoFindings(found, "stress test breaks calm rules");
});

test("hospitals lists results for a pincode with a pager", async ({ page }) => {
  await asRealAccount(page);
  await page.goto("/hospitals");
  await expect(page.getByText("Type a pincode to see which hospitals take your policy without cash.")).toBeVisible();
  await page.getByLabel("Pincode").fill("560038");
  await page.getByRole("button", { name: "Find hospitals" }).click();
  await expect(page.getByTestId("hospital-count")).toHaveText("12 hospitals near 560038 · 8 cashless");
  await expect(page.getByRole("list", { name: "Hospitals" }).getByText("Example Hospital 1", { exact: true })).toBeVisible();
  await expect(page.locator('[data-cashless="false"]').first()).toContainText("Cashless not listed");
  const pageStatus = page.getByRole("status").filter({ hasText: /Page \d+ of \d+/ });
  await expect(pageStatus).toContainText(/Page 1 of \d+/);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pageStatus).toContainText(/Page 2 of \d+/);
  await page.getByLabel("Pincode").fill("560099");
  await page.getByRole("button", { name: "Find hospitals" }).click();
  await expect(page.getByText("No network hospital is listed for this pincode. Try a nearby one.")).toBeVisible();
  await shot(page, "hospitals");
});

test("hospitals is calm before and after a search at every laptop size", async ({ page }) => {
  await asRealAccount(page);
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/hospitals");
    await expect(page.getByText("Type a pincode to see which hospitals take your policy without cash.")).toBeVisible();
    await settle(page);
    await expectCalm(page, "hospitals before search", found);
    await page.getByLabel("Pincode").fill("560038");
    await page.getByRole("button", { name: "Find hospitals" }).click();
    await expect(page.getByTestId("hospital-count")).toBeVisible();
    await settle(page);
    await expectCalm(page, "hospitals after search", found);
    await shot(page, "hospitals");
  }
  expectNoFindings(found, "hospitals breaks calm rules");
});

test("long names and a short viewport cut nothing off on compare, stress test and hospitals", async ({ page }) => {
  await asRealAccount(page, { long: true });
  const found: Sink = [];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/compare");
  await expect(page.getByTestId("compare-table")).toBeVisible();
  await settle(page);
  await expectCalm(page, "compare long", found);
  await page.goto("/stress-test");
  await expect(page.getByTestId("stress-result")).toBeVisible();
  await settle(page);
  await expectCalm(page, "stress long", found);
  await page.goto("/hospitals");
  await page.getByLabel("Pincode").fill("560038");
  await page.getByRole("button", { name: "Find hospitals" }).click();
  await expect(page.getByTestId("hospital-count")).toBeVisible();
  await settle(page);
  await expectCalm(page, "hospitals long", found);

  await asRealAccountShort(page, found);
  expectNoFindings(found, "long names or a short viewport cut something off");
});

async function asRealAccountShort(page: Page, found: Sink): Promise<void> {
  // A second, default account on the same page: routes registered later answer first, so the plain two-policy fixtures replace the long ones.
  await asRealAccount(page);
  await page.setViewportSize(SHORT_VIEWPORT);
  await page.goto("/compare");
  await expect(page.getByTestId("compare-table")).toBeVisible();
  await settle(page);
  await expectNothingCutOff(page, "compare short", found);
  await page.goto("/stress-test");
  await page.getByLabel("Hospital bill, in rupees").fill("1500000");
  await settle(page);
  await expectNothingCutOff(page, "stress short", found);
  await page.goto("/hospitals");
  await page.getByLabel("Pincode").fill("560038");
  await page.getByRole("button", { name: "Find hospitals" }).click();
  await expect(page.getByTestId("hospital-count")).toBeVisible();
  await settle(page);
  await expectNothingCutOff(page, "hospitals short", found);
}
