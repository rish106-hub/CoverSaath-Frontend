import { expect, test, type Page } from "@playwright/test";

test.use({ channel: "chrome" });

// T2: one calm load stage. Runs against the mock-adapter dev server (see playwright.config.ts); no sign-in step is needed with mock adapters.

const ROUTES = ["/home", "/policies", "/chat"];

// Mock access: the sign-in screen at the root, phone way in; the mock takes any six digits as the code, same steps as e2e/journey.spec.ts.
async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Enter the code", level: 1 })).toBeVisible();
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type("123456");
  await expect(page.getByRole("heading", { name: "You’re in.", level: 1 })).toBeVisible();
}

async function slowApi(page: Page, ms = 800) {
  await page.route("**/api/**", async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

test("no remount", async ({ page }) => {
  await signIn(page);
  await page.goto("/home");
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(() => {
    (document.querySelector("main") as unknown as { __t2: string }).__t2 = "x";
    (document.querySelector("nav") as unknown as { __t2: string }).__t2 = "x";
  });
  for (const path of ["/policies", "/family"]) {
    await page.locator(`nav a[href="${path}"]`).first().click();
    await page.waitForURL(`**${path}`);
    const same = await page.evaluate(() => {
      const m = document.querySelector("main") as unknown as { __t2?: string; isConnected: boolean };
      const n = document.querySelector("nav") as unknown as { __t2?: string; isConnected: boolean };
      return m.__t2 === "x" && m.isConnected && n.__t2 === "x" && n.isConnected;
    });
    expect(same, `main and sidebar survive navigation to ${path}`).toBe(true);
  }
});

test("one stage", async ({ page }) => {
  await signIn(page);
  for (const path of ROUTES) {
    await slowApi(page);
    let sawLoadingText = false;
    const poll = setInterval(() => {
      // Visible text only: screen-reader-only "Loading" labels (skeleton, heading placeholder) are hidden from sight and are allowed.
      page.getByText(/Loading/).evaluateAll((els) => els.filter((e) => !e.closest("[data-skeleton], .sr-only")).length)
        .then((n) => { if (n > 0) sawLoadingText = true; }).catch(() => {});
    }, 100);
    // "commit" returns before hydration, so the skeleton is still on screen when we start looking.
    await page.goto(path, { waitUntil: "commit" });
    await expect(page.locator("[data-skeleton]").first(), `skeleton before data on ${path}`).toBeVisible();
    await expect(page.locator("[data-skeleton]")).toHaveCount(0, { timeout: 15_000 });
    clearInterval(poll);
    expect(sawLoadingText, `no text loader on ${path}`).toBe(false);
    // Once the skeleton has gone the page content is on screen and fully opaque: one stage, no second pass over the same area.
    // Enter and press motion is measured in t10-motion.spec.ts, so nothing here pins an animation.
    const content = page.locator("main#main-content > *:not(.k-no-fade)").first();
    await expect(content, `content on ${path}`).toBeVisible();
    await expect(content, `content opaque on ${path}`).toHaveCSS("opacity", "1");
    await page.unrouteAll();
  }
});

test("no text swap", async ({ page }) => {
  await signIn(page);
  await page.addInitScript(() => {
    const seen: Record<string, string[]> = { h1: [], chip: [] };
    (window as unknown as { __t2seen: typeof seen }).__t2seen = seen;
    const record = () => {
      // The laptop gate also holds an h1 (hidden by CSS above 1024px), so the page heading is looked up inside the page itself.
      const h1 = document.querySelector("#main-content h1")?.textContent?.trim();
      const chip = document.querySelector('a[href="/profile"][class*="chip"]')?.textContent?.trim();
      if (h1 && !seen.h1.includes(h1)) seen.h1.push(h1);
      if (chip && !seen.chip.includes(chip)) seen.chip.push(chip);
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, characterData: true });
  });
  for (const path of ["/home", "/profile", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("[data-skeleton]")).toHaveCount(0, { timeout: 15_000 });
    await page.waitForTimeout(500);
    const seen = await page.evaluate(() => (window as unknown as { __t2seen: Record<string, string[]> }).__t2seen);
    // "Loading" only ever lives in sr-only spans; an h1 holding only that label is the skeleton stage, not a text value.
    for (const key of ["h1", "chip"]) {
      const values = seen[key].filter((v) => v !== "Loading");
      expect(values.length, `${key} on ${path} took ${JSON.stringify(seen[key])}`).toBeLessThanOrEqual(1);
      for (const v of values) {
        expect(v).not.toBe("Your account");
        expect(v).not.toMatch(/^Good (morning|afternoon|evening)\.$/);
      }
    }
  }
});

test("budget", async ({ page }) => {
  await signIn(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __shift: number; __long: number[] };
    w.__shift = 0;
    w.__long = [];
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) w.__shift += e.value; }).observe({ type: "layout-shift", buffered: true });
    } catch { /* layout-shift unsupported */ }
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { const fcp = performance.getEntriesByName("first-contentful-paint")[0]; if (fcp && e.startTime > fcp.startTime) w.__long.push(e.duration); } }).observe({ type: "long-animation-frame", buffered: true });
    } catch { /* long-animation-frame unsupported */ }
  });
  for (const path of ROUTES) {
    await page.goto(path);
    await expect(page.locator("[data-skeleton]")).toHaveCount(0, { timeout: 15_000 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const w = window as unknown as { __shift: number; __long: number[] };
      const props = document.getAnimations().flatMap((a) => {
        const k = (a.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
        return k.flatMap((f) => Object.keys(f));
      });
      return { shift: w.__shift, long: w.__long, props, hasLoaf: PerformanceObserver.supportedEntryTypes.includes("long-animation-frame") };
    });
    expect(r.shift, `layout shift on ${path}`).toBeLessThanOrEqual(0.02);
    // The 100 ms budget is for a production build. The dev server compiles on demand, so there the limit is looser.
    const limit = process.env.PW_PROD_BUILD === "1" ? 100 : 300;
    if (r.hasLoaf) expect(r.long.filter((d) => d > limit), `long frames on ${path}`).toEqual([]);
    else test.info().annotations.push({ type: "skip", description: "long-animation-frame API unavailable" });
    expect(r.props.filter((p) => /^(top|left|width|height|margin|padding)/.test(p)), `layout properties animating on ${path}`).toEqual([]);
  }
});
