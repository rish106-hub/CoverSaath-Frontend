import { expect, type Page } from "@playwright/test";

/** Opens /covers/add, gives the reading go-ahead if asked, picks the cover type and sends the schedule PDF. */
export async function addSchedule(page: Page, file: { name: string; buffer: Buffer }): Promise<void> {
  await page.goto("/covers/add");
  // The page shows "Loading..." until it knows whether consent was given: wait for whichever step comes up, never test once.
  const agree = page.getByRole("checkbox");
  const type = page.getByTestId("policy-type");
  await expect(agree.or(type)).toBeVisible();
  if (await agree.isVisible()) {
    await agree.check();
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(type).toBeEnabled();
  await type.selectOption("personal_health");
  await page.getByTestId("schedule-input").setInputFiles({ name: file.name, mimeType: "application/pdf", buffer: file.buffer });
}
