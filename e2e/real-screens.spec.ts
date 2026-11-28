import { expect, test, type Page } from "@playwright/test";
import { asRealAccount } from "./real-account";
import { expectCalm, expectNoFindings, expectNothingCutOff, shot, SIZES, type Sink } from "./real-calm";

// The real-account screens (home, my policies, policy detail, add-a-policy wizard) in a real browser, on a dev server in backend mode with
// no backend behind it: the browser's own /api/app/* calls are answered with synthetic data by asRealAccount. This proves what unit tests
// cannot: nothing scrolls, no small or thin text, the laptop gate works. Run with playwright.real.config.ts (own port).
//
// Sign-in: there is no form. The beta access card ("Get access", then /welcome) is not used here; asRealAccount sets the plain session
// cookie the proxy looks for, and the session itself is read from /api/app/me. A rule the product breaks is a finding, never loosened here.

// A 13-inch laptop with browser toolbars leaves about this much page height; the page may scroll here.
const SHORT_VIEWPORT = { width: 1280, height: 560 } as const;
const LONG_PRODUCT_NAME = "Example Comprehensive Family Health Protection Plan Platinum 2026";
const POLICY_TABS = ["Limits", "Waiting", "Exclusions", /Not found/, "Insurer terms"] as const;

type PaymentWindow = "pay" | "close";

/**
 * Replaces Razorpay Checkout before any page script runs, so the real checkout script is never requested. `open()` either hands the
 * `handler` three synthetic ids (the person paid) or calls `modal.ondismiss` (the person closed the window).
 */
async function installFakePaymentWindow(page: Page, mode: PaymentWindow): Promise<void> {
  await page.addInitScript((chosen) => {
    class FakeRazorpay {
      private readonly options: { order_id: string; handler: (r: Record<string, string>) => void; modal: { ondismiss: () => void } };
      constructor(options: FakeRazorpay["options"]) { this.options = options; }
      on(): void { /* payment.failed is never raised by the fake */ }
      open(): void {
        setTimeout(() => {
          if (chosen === "pay") this.options.handler({ razorpay_order_id: this.options.order_id, razorpay_payment_id: "pay_e2e_synthetic_1", razorpay_signature: "0".repeat(64) });
          else this.options.modal.ondismiss();
        }, 50);
      }
    }
    (window as unknown as { Razorpay: unknown }).Razorpay = FakeRazorpay;
  }, mode);
}

/** Opens the wizard of an account that must pay first and reaches the pay screen, granting reading consent when it is asked for. */
async function openPayScreen(page: Page): Promise<void> {
  await page.goto("/covers/add");
  const consent = page.getByRole("button", { name: "Yes, read my policy" });
  const pay = page.getByTestId("pay-card");
  await expect(consent.or(pay)).toBeVisible();
  if (await consent.isVisible()) await consent.click();
  await expect(pay).toBeVisible();
}

test("home shows the cover sentence and one next step for a real account", async ({ page }) => {
  await asRealAccount(page);
  await page.goto("/home");
  await expect(page.getByTestId("home-cover")).toHaveText("2");
  await expect(page.getByText(/policies on Knowvia/)).toBeVisible();
  await expect(page.getByTestId("home-next")).toBeVisible();
  await expect(page.getByTestId("home-next")).toContainText("Ask now");
  await expect(page.getByTestId("home-renewal")).toBeVisible();
  await expect(page.getByTestId("home-policy")).toHaveCount(2);
  await shot(page, "home");
});

test("home is calm at every laptop size", async ({ page }) => {
  await asRealAccount(page);
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/home");
    await expect(page.getByTestId("home-next")).toBeVisible();
    await expectCalm(page, "home", found);
    await shot(page, "home");
  }
  expectNoFindings(found, "home breaks calm rules");
});

test("my policies shows one card per policy and no pager for two", async ({ page }) => {
  await asRealAccount(page, { policies: 2 });
  await page.goto("/policies");
  await expect(page.getByTestId("policy-count")).toHaveText("2 policies");
  await expect(page.getByTestId("policy-card")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Example Health Plan 01" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Page \d of \d/)).toHaveCount(0);
  await shot(page, "policies-two");
});

test("five policies page at four", async ({ page }) => {
  await asRealAccount(page, { policies: 5 });
  await page.goto("/policies");
  await expect(page.getByTestId("policy-count")).toHaveText("5 policies");
  await expect(page.getByTestId("policy-card")).toHaveCount(4);
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await shot(page, "policies-five-page-1");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("policy-card")).toHaveCount(1);
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
});

test("my policies is calm at every laptop size", async ({ page }) => {
  await asRealAccount(page, { policies: 5 });
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/policies");
    // Fit rule (spec R5b.7): the grid shows two cards per row for as many rows as it is tall enough for, so the 650px laptop shows one row of two.
    await expect(page.getByTestId("policy-card")).toHaveCount(size.height < 700 ? 2 : 4);
    await expectCalm(page, "my policies", found);
    await shot(page, "policies");
  }
  expectNoFindings(found, "my policies breaks calm rules");
});

test("policy page shows the header card and switches fact groups", async ({ page }) => {
  await asRealAccount(page);
  await page.goto("/policies/h1");
  await expect(page.getByRole("heading", { name: "Example Health Plan 01", level: 1 })).toBeVisible();
  await expect(page.getByTestId("headlines").locator("li")).toHaveCount(3);
  await expect(page.getByRole("tab", { name: "Limits" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-panel="limits"]')).toBeVisible();
  await page.getByRole("tab", { name: "Waiting" }).click();
  await expect(page.getByRole("tab", { name: "Waiting" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-panel="waiting"]')).toBeVisible();
  await expect(page.locator('[data-panel="limits"]')).toBeHidden();
  await expect(page.locator('[data-panel="waiting"] li')).toHaveCount(4);
  await shot(page, "policy-detail-waiting");
});

test("a group of nine facts pages at six", async ({ page }) => {
  await asRealAccount(page);
  await page.goto("/policies/h1");
  await page.getByRole("tab", { name: "Limits" }).click();
  const panel = page.locator('[data-panel="limits"]');
  await expect(panel.locator("ul li")).toHaveCount(6);
  await expect(panel.getByText("Page 1 of 2")).toBeVisible();
  await expect(panel.getByText("Next renewal")).toBeVisible();
  await shot(page, "policy-detail-limits-page-1");
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(panel.locator("ul li")).toHaveCount(3);
  await expect(panel.getByText("Page 2 of 2")).toBeVisible();
});

/** Visits every tab of policy h1 (and page 2 of the nine-fact group) and measures each with `check`. */
async function walkPolicyTabs(page: Page, prefix: string, screenName: string, check: (page: Page, label: string, sink?: Sink) => Promise<void>, found: Sink, expectedTitle: string): Promise<void> {
  await page.goto("/policies/h1");
  await expect(page.getByRole("heading", { name: expectedTitle, level: 1 })).toBeVisible();
  for (const tab of POLICY_TABS) {
    await page.getByRole("tab", { name: tab }).click();
    const name = typeof tab === "string" ? tab : "Not found";
    const screen = `${prefix}policy-detail-${name.toLowerCase().replace(/ /g, "-")}`;
    if (name === "Insurer terms") await expect(page.getByTestId("memory-document")).toBeVisible();
    await check(page, `${screenName} / ${name}`, found);
    await shot(page, screen);
  }
  // The second page of the nine-fact group is a different layout from the first.
  await page.getByRole("tab", { name: "Limits" }).click();
  await page.locator('[data-panel="limits"]').getByRole("button", { name: "Next", exact: true }).click();
  await check(page, `${screenName} / Limits page 2`, found);
  await shot(page, `${prefix}policy-detail-limits-page-2`);
}

test("policy page is calm on every tab at every laptop size", async ({ page }) => {
  test.setTimeout(90_000);
  await asRealAccount(page);
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await walkPolicyTabs(page, "", "policy detail", expectCalm, found, "Example Health Plan 01");
  }
  expectNoFindings(found, "policy detail breaks calm rules");
});

// The wizard keeps its state in the synthetic account (consent, upload), so every size starts from a fresh browser context and account.
test("the wizard is calm on every step at every laptop size", async ({ browser }) => {
  test.setTimeout(300_000);
  const found: Sink = [];
  for (const size of SIZES) {
    const context = await browser.newContext({ viewport: size, baseURL: `http://localhost:${process.env.KV_E2E_PORT ?? "3312"}` });
    try {
      const page = await context.newPage();
      await asRealAccount(page, { policies: 1 });
      await page.goto("/covers/add");

      // Consent, then find, reading (two progress steps), plan, family, done.
      await expect(page.getByRole("heading", { name: "Can Knowvia read your policy?" })).toBeVisible();
      await expectCalm(page, "wizard / consent", found);
      await shot(page, "wizard-consent");
      await page.getByRole("button", { name: "Yes, read my policy" }).click();

      await expect(page.getByRole("heading", { name: "Drop your policy PDF here." })).toBeVisible();
      await expectCalm(page, "wizard / find", found);
      await shot(page, "wizard-find");
      await page.getByTestId("schedule-input").setInputFiles({ name: "schedule.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%% synthetic schedule\n%%EOF\n") });

      await expect(page.locator('[data-screen="reading"]')).toBeVisible();
      await expectCalm(page, "wizard / reading (checking)", found);
      await shot(page, "wizard-reading-checking");
      await expect(page.locator('[data-stage="reading"]')).toBeVisible({ timeout: 15_000 });
      await expectCalm(page, "wizard / reading (reading)", found);
      await shot(page, "wizard-reading");

      await expect(page.getByRole("heading", { name: "Which plan is this?" })).toBeVisible({ timeout: 30_000 });
      await expectCalm(page, "wizard / plan", found);
      await shot(page, "wizard-plan");
      await page.getByRole("radio").first().check();
      await page.getByRole("button", { name: /^Yes, it is/ }).click();

      await expect(page.getByRole("heading", { name: "Who is in your family?" })).toBeVisible();
      await expectCalm(page, "wizard / family", found);
      await shot(page, "wizard-family");
      await page.getByRole("button", { name: "Continue" }).click();

      await expect(page.getByText("Your cover is saved.")).toBeVisible();
      await expectCalm(page, "wizard / done", found);
      await shot(page, "wizard-done");
    } finally {
      await context.close();
    }
  }
  expectNoFindings(found, "the wizard breaks calm rules");
});

test("under 1024px wide the laptop gate shows and the app is hidden", async ({ page }) => {
  await asRealAccount(page);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto("/home");
  await expect(page.getByTestId("viewport-gate")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open Knowvia on a laptop." })).toBeVisible();
  await expect(page.locator("main")).toBeHidden();
  await expect(page.getByTestId("home-next")).toBeHidden();
  await shot(page, "gate");
  // At 1024 the gate is gone and the app shows.
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.getByTestId("viewport-gate")).toBeHidden();
  await expect(page.getByTestId("home-next")).toBeVisible();
});

test("no call reaches the backend API and no app call is unhandled", async ({ page }) => {
  test.setTimeout(90_000);
  const backendCalls: string[] = [];
  page.on("request", (r) => { if (/\/api\/v1\//.test(r.url())) backendCalls.push(`${r.method()} ${r.url()}`); });
  const { unhandled } = await asRealAccount(page);
  for (const path of ["/home", "/policies", "/policies/h1", "/covers/add"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    // Let the screen's own calls finish before the next page.
    await page.waitForLoadState("networkidle");
  }
  expect(backendCalls, "no browser call to /api/v1").toEqual([]);
  expect(unhandled, "no app call without a fixture").toEqual([]);
});

// ---- long names, short laptops, pay states (R4b) ----------------------------------------------------------------------------

test("long names and three open details stay inside their cards on home, list and detail", async ({ page }) => {
  test.setTimeout(120_000);
  await asRealAccount(page, { long: true, policies: 2 });
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/home");
    await expect(page.getByTestId("home-next")).toBeVisible();
    await expectNothingCutOff(page, "long names / home", found);
    await shot(page, "long-home");

    await page.goto("/policies");
    await expect(page.getByTestId("policy-card")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: LONG_PRODUCT_NAME })).toBeVisible();
    await expect(page.getByText("3 details need your decision")).toBeVisible();
    await expectNothingCutOff(page, "long names / my policies", found);
    await shot(page, "long-policies");

    await walkPolicyTabs(page, "long-", "long names / policy detail", expectNothingCutOff, found, LONG_PRODUCT_NAME);
  }
  expectNoFindings(found, "long names or open details are cut off");
});

test("below 640px tall nothing is cut off on home, list and detail", async ({ page }) => {
  test.setTimeout(120_000);
  await asRealAccount(page, { long: true, policies: 5 });
  const found: Sink = [];
  await page.setViewportSize(SHORT_VIEWPORT);
  await page.goto("/home");
  await expect(page.getByTestId("home-next")).toBeVisible();
  await expectNothingCutOff(page, "short / home", found);
  await shot(page, "short-home");

  await page.goto("/policies");
  await expect(page.getByTestId("policy-card")).toHaveCount(4);
  await expectNothingCutOff(page, "short / my policies", found);
  await shot(page, "short-policies");

  await walkPolicyTabs(page, "short-", "short / policy detail", expectNothingCutOff, found, LONG_PRODUCT_NAME);
  expectNoFindings(found, "content is cut off on a short laptop");
});

test("the pay screen shows the price and is calm at every laptop size", async ({ page }) => {
  test.setTimeout(90_000);
  await asRealAccount(page, { canAdd: false });
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await openPayScreen(page);
    await expect(page.getByRole("heading", { name: "Add another policy for Rs 199." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay Rs 199" })).toBeVisible();
    await expectCalm(page, "pay screen", found);
    await shot(page, "pay");
  }
  expectNoFindings(found, "the pay screen breaks calm rules");
});

test("closing the payment window shows the reason and offers Pay again", async ({ page }) => {
  await installFakePaymentWindow(page, "close");
  const { unhandled } = await asRealAccount(page, { canAdd: false });
  await openPayScreen(page);
  await page.getByRole("button", { name: "Pay Rs 199" }).click();
  await expect(page.getByText("You closed the payment window. Nothing was paid.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay Rs 199" })).toBeVisible();
  await shot(page, "pay-closed");
  expect(unhandled, "no call without a fixture or to the real checkout").toEqual([]);
});

test("a confirmed payment moves on with the paid notice", async ({ page }) => {
  await installFakePaymentWindow(page, "pay");
  const { unhandled } = await asRealAccount(page, { canAdd: false, verify: "ok" });
  await openPayScreen(page);
  await page.getByRole("button", { name: "Pay Rs 199" }).click();
  await expect(page.getByText("Paid. You can add your policy now.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drop your policy PDF here." })).toBeVisible();
  await expect(page.getByTestId("pay-card")).toHaveCount(0);
  await shot(page, "pay-paid");
  expect(unhandled, "no call without a fixture or to the real checkout").toEqual([]);
});

test("an unconfirmed payment offers Check again and no Pay button", async ({ page }) => {
  // Three verify tries and three slot reads with waits in between: about ten seconds before the screen gives up.
  test.setTimeout(90_000);
  await installFakePaymentWindow(page, "pay");
  const { unhandled } = await asRealAccount(page, { canAdd: false, verify: "down" });
  await openPayScreen(page);
  await page.getByRole("button", { name: "Pay Rs 199" }).click();
  await expect(page.getByText(/We are still confirming your payment/)).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay Rs/ })).toHaveCount(0);
  await shot(page, "pay-unconfirmed");
  expect(unhandled, "no call without a fixture or to the real checkout").toEqual([]);
});

test("home with one policy shows the policy, ask and next-step cards", async ({ page }) => {
  await asRealAccount(page, { policies: 1 });
  await page.goto("/home");
  await expect(page.getByTestId("home-cover")).toHaveText("Rs 5,00,000");
  await expect(page.getByTestId("home-policy")).toHaveCount(1);
  await expect(page.getByText("Ask about your cover").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "What are my waiting periods?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "What does my policy not cover?" })).toBeVisible();
  await expect(page.getByText("Your next step")).toBeVisible();
  await expect(page.getByTestId("home-next")).toBeVisible();
  await shot(page, "home-one-policy");
});
