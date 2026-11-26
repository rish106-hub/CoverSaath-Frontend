import { expect, test } from "@playwright/test";

// The household cover memory page against the mock adapter (no backend): all 14 section headings show.
const SECTIONS = ["At a glance", "Policies", "People covered", "Premiums and renewals", "Cover and limits", "Waiting periods", "Exclusions, terms and key clauses", "OPD, vaccination and wellness", "Claims, TPA and network hospitals", "Contacts and helplines", "Declarations and consistency", "Differences between policies", "Open questions and conflicts", "Where this comes from"];

test("family memory page shows the 14 cover memory sections", async ({ page }) => {
  await page.goto("/family/memory");
  await expect(page.getByRole("heading", { name: "Cover memory", level: 1 })).toBeVisible();
  for (const name of SECTIONS) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
});
