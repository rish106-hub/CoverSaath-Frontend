import { expect, test, type Page } from "@playwright/test";
import { asRealAccount } from "./real-account";

// The real-account screens (home, my policies, policy detail, add-a-policy wizard) in a real browser, on a dev server in backend mode with
// no backend behind it: the browser's own /api/app/* calls are answered with synthetic data by asRealAccount. This proves what unit tests
// cannot: nothing scrolls, no small or thin text, the laptop gate works. Run with playwright.real.config.ts (own port).
//
// Sign-in: there is no form. The beta access card ("Get access", then /welcome) is not used here; asRealAccount sets the plain session
// cookie the proxy looks for, and the session itself is read from /api/app/me. A rule the product breaks is a finding, never loosened here.

const SHOTS = "test-results/real/";

type Sink = string[];

/**
 * Measures one screen and reports every broken rule: the document and `main` must not scroll, and no visible element that directly holds
 * text may be under 16px or under weight 500. Text inside [data-panel="terms"] is skipped for the scroll rule only (that panel is hidden
 * while the scroll rules are measured). With a `sink` the broken rules are collected under `label`; without one they fail the test at once.
 */
async function expectCalm(page: Page, label: string, sink?: Sink): Promise<void> {
  const found = await page.evaluate(() => {
    const out: string[] = [];
    const small = new Map<string, string>();
    const thin = new Map<string, string>();
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "").map((n) => (n.textContent ?? "").trim()).join(" ");
      if (!own) continue;
      const box = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      // An element is visible when it has a real box and is not hidden; 1px boxes are screen-reader-only text.
      if (box.width <= 1 || box.height <= 1 || css.display === "none" || css.visibility === "hidden" || Number(css.opacity) === 0) continue;
      const fontSize = parseFloat(css.fontSize);
      const fontWeight = parseInt(css.fontWeight, 10);
      const tag = `<${el.tagName.toLowerCase()}> "${own.slice(0, 50)}"`;
      if (fontSize < 16) small.set(tag, `fontSize ${fontSize}px (under 16)`);
      if (fontWeight < 500) thin.set(tag, `fontWeight ${fontWeight} (under 500)`);
    }
    for (const [tag, why] of small) out.push(`${tag}: ${why}`);
    for (const [tag, why] of thin) out.push(`${tag}: ${why}`);
    const terms = Array.from(document.querySelectorAll<HTMLElement>('[data-panel="terms"]'));
    const shown = terms.map((t) => t.style.display);
    terms.forEach((t) => { t.style.display = "none"; });
    const doc = document.documentElement;
    if (doc.scrollHeight > window.innerHeight + 1) out.push(`document scrollHeight ${doc.scrollHeight} > innerHeight ${window.innerHeight} + 1`);
    const main = document.querySelector("main");
    if (main && main.scrollHeight > main.clientHeight + 1) out.push(`main scrollHeight ${main.scrollHeight} > clientHeight ${main.clientHeight} + 1`);
    terms.forEach((t, i) => { t.style.display = shown[i] ?? ""; });
    return out;
  });
  const viewport = page.viewportSize();
  const tagged = found.map((f) => `${label} @ ${viewport?.width}x${viewport?.height}: ${f}`);
  if (sink) sink.push(...tagged);
  else expect(tagged, "calm rules (scrollHeight/clientHeight, fontSize, fontWeight)").toEqual([]);
}

const shot = async (page: Page, screen: string): Promise<void> => {
  await page.screenshot({ path: `${SHOTS}${screen}-${page.viewportSize()?.width}.png`, animations: "disabled" });
};

const SIZES = [{ width: 1440, height: 900 }, { width: 1280, height: 800 }] as const;

test("home shows the cover sentence and one next step for a real account", async ({ page }) => {
  await asRealAccount(page);
  await page.goto("/home");
  await expect(page.getByTestId("home-cover")).toHaveText("2");
  await expect(page.getByText(/policies on Knowvia/)).toBeVisible();
  await expect(page.getByTestId("home-next")).toBeVisible();
  await expect(page.getByTestId("home-next")).toContainText("Ask about your cover");
  await shot(page, "home");
});

test("home is calm at 1440x900 and 1280x800", async ({ page }) => {
  await asRealAccount(page);
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/home");
    await expect(page.getByTestId("home-next")).toBeVisible();
    await expectCalm(page, "home", found);
    await shot(page, "home");
  }
  expect(found, "home breaks calm rules").toEqual([]);
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

test("my policies is calm at 1440x900 and 1280x800", async ({ page }) => {
  await asRealAccount(page, { policies: 5 });
  const found: Sink = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/policies");
    await expect(page.getByTestId("policy-card")).toHaveCount(4);
    await expectCalm(page, "my policies", found);
    await shot(page, "policies");
  }
  expect(found, "my policies breaks calm rules").toEqual([]);
});

test("policy detail opens on At a glance and switches to a fact group", async ({ page }) => {
  await asRealAccount(page);
  await page.goto("/policies/h1");
  await expect(page.getByRole("heading", { name: "Example Health Plan 01", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "At a glance" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-panel="glance"]')).toBeVisible();
  await page.getByRole("tab", { name: "Waiting" }).click();
  await expect(page.getByRole("tab", { name: "Waiting" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-panel="waiting"]')).toBeVisible();
  await expect(page.locator('[data-panel="glance"]')).toBeHidden();
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

test("policy detail is calm at 1440x900 and 1280x800", async ({ page }) => {
  await asRealAccount(page);
  const found: Sink = [];
  const tabs = ["At a glance", "Limits", "Waiting", "Exclusions", /Not found/, "Insurer terms"] as const;
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/policies/h1");
    await expect(page.getByRole("heading", { name: "Example Health Plan 01", level: 1 })).toBeVisible();
    for (const tab of tabs) {
      await page.getByRole("tab", { name: tab }).click();
      const name = typeof tab === "string" ? tab : "Not found";
      const screen = `policy-detail-${name.toLowerCase().replace(/ /g, "-")}`;
      if (name === "Insurer terms") await expect(page.getByTestId("memory-document")).toBeVisible();
      await expectCalm(page, `policy detail / ${name}`, found);
      await shot(page, screen);
    }
    // The second page of the nine-fact group is a different layout from the first.
    await page.getByRole("tab", { name: "Limits" }).click();
    await page.locator('[data-panel="limits"]').getByRole("button", { name: "Next", exact: true }).click();
    await expectCalm(page, "policy detail / Limits page 2", found);
    await shot(page, "policy-detail-limits-page-2");
  }
  expect(found, "policy detail breaks calm rules").toEqual([]);
});

test("the wizard is calm on every step at 1440x900", async ({ page }) => {
  test.setTimeout(90_000);
  await asRealAccount(page, { policies: 1 });
  const found: Sink = [];
  await page.setViewportSize({ width: 1440, height: 900 });
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
  expect(found, "the wizard breaks calm rules").toEqual([]);
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
