import { expect, test } from "@playwright/test";

// The one-person journey against the mock adapters (no backend): profile, the one schedule PDF added (insurer terms are attached by the system),
// the chat go-ahead, then a clause question answered with its document and page. The dev server runs with NEXT_PUBLIC_ADAPTERS=mock.
// Mock state lives in the page, so moves between pages use the app's own links. No browser call may go to /api/v1.

const PDF = (n: string) => Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%% ${n}\n%%EOF\n`);

test("profile, one schedule PDF, go-ahead, clause question with citation", async ({ page }) => {
  test.setTimeout(120_000);
  const backendCalls: string[] = [];
  page.on("request", (r) => { if (/\/api\/v1\//.test(r.url())) backendCalls.push(r.url()); });

  // Sign in with a phone number: the mock accepts any six digits as the code. The page moves on by its own link, not by a reload (mock state lives in the page).
  await page.goto("/");
  await page.getByRole("tab", { name: "Phone" }).click();
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Enter the code", level: 1 })).toBeVisible();
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type("123456");
  await expect(page.getByRole("heading", { name: "You’re in.", level: 1 })).toBeVisible();

  // One upload: the schedule makes the cover. There is no second slot.
  await page.getByRole("link", { name: "Add my policy" }).click();
  await page.waitForURL(/\/covers\/add/);
  await expect(page.getByRole("heading", { name: "Can Knowvia read your policy?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, read my policy" }).click();
  await page.getByTestId("policy-type").selectOption("personal_health");

  const add = async (slot: string, name: string) => {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator(`[data-slot="${slot}"]`).click()]);
    await chooser.setFiles({ name, mimeType: "application/pdf", buffer: PDF(name) });
  };
  await add("policy_schedule", "schedule.pdf");
  await expect(page.getByRole("heading", { name: "Which plan is this?" })).toBeVisible();
  await expect(page.locator('[data-slot="policy_wording"]')).toHaveCount(0);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /Yes, it is/ }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByText("Your cover is saved.")).toBeVisible();

  // Chat: leave the wizard by its own link, then take the rail to Ask. Go-ahead first, then a clause question.
  await page.getByRole("link", { name: "Close" }).click();
  await page.getByRole("navigation", { name: "Knowvia sections" }).getByRole("link", { name: "Ask", exact: true }).click();
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
