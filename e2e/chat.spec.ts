import { expect, test } from "@playwright/test";
import { addSchedule } from "./add-cover";

// Smoke for chat and hospitals against the mock adapter (no backend): ask a seeded question, see the streamed answer with facts chips, then
// list hospitals for a seeded pincode. No browser call may go to /api/v1. The dev server runs with NEXT_PUBLIC_ADAPTERS=mock.

const SYNTHETIC_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test("ask a seeded question and see a streamed answer with facts chips", async ({ page }) => {
  const backendCalls: string[] = [];
  page.on("request", (r) => { if (/\/api\/v1\//.test(r.url())) backendCalls.push(r.url()); });

  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "Ask about your cover", level: 1 })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Before we answer")).toBeHidden();
  await page.getByRole("button", { name: /Planned knee surgery in Jan/ }).click();

  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByText("You", { exact: true })).toBeVisible();
  const facts = log.getByRole("list", { name: "Facts used" });
  await expect(facts).toBeVisible();
  await expect(facts.getByText("Initial waiting period")).toBeVisible();
  await expect(facts.getByText("Room rent limit")).toBeVisible();
  await expect(facts.getByText("Check with the insurer")).toBeVisible();
  await expect(log.getByText(/covered once the 30 day initial waiting period/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/SYNTH|\bUIN\b/);

  // A second question in the same thread, typed.
  await page.getByLabel("Your question").fill("What are my waiting periods?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(log.getByText(/36 months for pre-existing diseases/)).toBeVisible();

  expect(backendCalls, "no browser call to the backend API").toEqual([]);
});

test("hospital list renders for a seeded pincode", async ({ page }) => {
  const backendCalls: string[] = [];
  page.on("request", (r) => { if (/\/api\/v1\//.test(r.url())) backendCalls.push(r.url()); });

  // Hospitals belong to a cover: add one first, then follow the link from the review page. The mock keeps holdings for the page's lifetime.
  await addSchedule(page, { name: "policy.pdf", buffer: SYNTHETIC_PDF });
  await expect(page.getByText(/We think this is/)).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /Yes, it is/ }).click();
  await page.getByRole("link", { name: "See what we found" }).click();
  await page.locator("a.k-btn", { hasText: "Network hospitals" }).press("Enter");

  await expect(page.getByRole("heading", { name: "Network hospitals", level: 1 })).toBeVisible({ timeout: 20_000 }); // the dev server compiles this page on first visit
  await page.getByRole("textbox", { name: "Pincode" }).fill("400053");
  await page.getByRole("button", { name: "Find hospitals" }).click();
  const list = page.getByRole("list", { name: "Hospitals" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(list.getByText("Example City Hospital")).toBeVisible();
  await expect(list.getByText("Cashless not listed")).toBeVisible();

  await page.getByRole("textbox", { name: "Pincode" }).fill("560001");
  await page.getByRole("button", { name: "Find hospitals" }).click();
  await expect(page.getByText(/No network hospital is listed/)).toBeVisible();

  expect(backendCalls, "no browser call to the backend API").toEqual([]);
});
