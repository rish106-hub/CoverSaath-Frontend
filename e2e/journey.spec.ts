import { expect, test } from "@playwright/test";

// The one-person journey against the mock adapters (no backend): profile, both policy PDFs added to one policy with per-document progress,
// the chat go-ahead, then a clause question answered with its document and page. The dev server runs with NEXT_PUBLIC_ADAPTERS=mock.
// Mock state lives in the page, so moves between pages use the app's own links. No browser call may go to /api/v1.

const PDF = (n: string) => Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%% ${n}\n%%EOF\n`);

test("profile, schedule and terms PDFs, go-ahead, clause question with citation", async ({ page }) => {
  test.setTimeout(120_000);
  const backendCalls: string[] = [];
  page.on("request", (r) => { if (/\/api\/v1\//.test(r.url())) backendCalls.push(r.url()); });

  // Profile.
  await page.goto("/");
  await page.getByLabel(/name/i).first().fill("Meera Rao");
  await page.getByLabel(/email/i).first().fill("meera.rao@company.com");
  await page.getByRole("button", { name: /get access/i }).click();
  // The card moves on to /welcome by itself; going elsewhere before that lands aborts the navigation.
  await page.waitForURL(/\/welcome/);
  await expect(page.getByText(/You.re in, Meera/).first()).toBeVisible();

  // Both documents of one policy: the schedule makes the cover, the terms and conditions are linked to it.
  await page.goto("/upload");
  await page.waitForURL(/\/covers\/add/);
  await expect(page.getByText("Before we start")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("policy-type").selectOption("personal_health");

  const add = async (slot: string, name: string) => {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator(`[data-slot="${slot}"]`).click()]);
    await chooser.setFiles({ name, mimeType: "application/pdf", buffer: PDF(name) });
  };
  await add("policy_schedule", "schedule.pdf");
  await expect(page.getByText("schedule.pdf: added.")).toBeVisible();
  await add("policy_wording", "terms.pdf");
  await expect(page.getByText("terms.pdf: added.")).toBeVisible();

  // Chat: go-ahead, then a clause question.
  await page.getByRole("link", { name: "Ask about your cover" }).first().click();
  await expect(page.getByRole("heading", { name: "Ask about your cover", level: 1 })).toBeVisible();
  await expect(page.getByText("Before we answer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Before we answer")).toBeHidden();

  await page.getByLabel("Your question").fill("What does the co-pay clause in my terms say?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByText(/10% co-payment/).first()).toBeVisible();
  const sources = log.getByRole("list", { name: "Sources" });
  await expect(sources.getByText("Policy terms and conditions, page 7")).toBeVisible();
  await expect(sources.getByText("Policy schedule, page 1")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\bUIN\b/);

  expect(backendCalls, "no browser call to the backend API").toEqual([]);
});
