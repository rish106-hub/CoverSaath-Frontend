import { expect, test } from "@playwright/test";
import { addSchedule } from "./add-cover";

// Smoke for the cover screens against the mock adapter (no backend): upload a synthetic PDF, confirm the plan, see the facts grid,
// settle a conflict. The mock adapters need no session. The dev server runs with NEXT_PUBLIC_ADAPTERS=mock (playwright.config.ts).

const SYNTHETIC_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test("add a cover, pick the plan, confirm, review facts and settle a conflict", async ({ page }) => {
  const backendCalls: string[] = [];
  page.on("request", (r) => { if (/\/api\/v1\//.test(r.url())) backendCalls.push(r.url()); });

  await addSchedule(page, { name: "policy.pdf", buffer: SYNTHETIC_PDF });
  await expect(page.getByRole("heading", { name: "Add a cover" })).toBeVisible();

  await expect(page.getByText(/We think this is/)).toBeVisible();
  await expect(page.getByText("Example Insurer – Example Health Plan 01")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.locator("body")).not.toContainText(/SYNTH|\bUIN\b/);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /Yes, it is/ }).click();
  await expect(page.getByText("Your cover is saved.")).toBeVisible();
  await expect(page.getByTestId("terms-input")).toHaveCount(0);

  await page.getByRole("link", { name: "See what we found" }).click();
  await expect(page).toHaveURL(/\/covers\/review\?holding=/);
  await expect(page.getByRole("heading", { name: "Needs your decision" })).toBeVisible();
  for (const g of ["Limits", "Waiting", "Exclusions", "Cashless", "Money"]) await expect(page.getByRole("heading", { name: g, exact: true })).toBeVisible();
  await expect(page.getByText("Sum insured", { exact: true })).toBeVisible();
  await expect(page.getByText("Rs 5,00,000").first()).toBeVisible();

  const card = page.getByRole("article", { name: "Room rent limit" });
  await expect(card.getByText("Your schedule, page 3", { exact: true })).toBeVisible();
  await expect(card.getByText("Insurer terms (verified), page 12", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: /Use Insurer terms \(verified\), page 12 for Room rent limit/ }).click();
  await expect(page.getByText("Room rent limit settled.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs your decision" })).toHaveCount(0);
  await expect(page.getByText("Confirmed by you")).toBeVisible();

  expect(backendCalls, "no browser call to the backend API").toEqual([]);
});

test("declarations and money saves a premium", async ({ page }) => {
  await addSchedule(page, { name: "policy.pdf", buffer: SYNTHETIC_PDF });
  await expect(page.getByText(/We think this is/)).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /Yes, it is/ }).click();
  // A link, not a reload: the mock keeps its holdings in memory for the page's lifetime.
  await page.getByRole("link", { name: "Add declarations and premium" }).click();
  await expect(page.getByRole("heading", { name: "Declarations and money" })).toBeVisible();
  await page.getByLabel("Amount in rupees").fill("18,500");
  await page.getByRole("button", { name: "Save premium" }).click();
  await expect(page.getByText("Premium saved.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Saved premiums" }).getByText("Rs 18,500")).toBeVisible();
});

test("a file over 4 MB is refused with a coded message", async ({ page }) => {
  await addSchedule(page, { name: "big.pdf", buffer: Buffer.alloc(4 * 1024 * 1024 + 10) });
  await expect(page.getByText(/too big/i)).toBeVisible();
});
