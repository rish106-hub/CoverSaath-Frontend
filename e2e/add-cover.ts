import type { Page } from "@playwright/test";

/** Opens /covers/add, gives the reading go-ahead if asked, picks the cover type and sends the schedule PDF. */
export async function addSchedule(page: Page, file: { name: string; buffer: Buffer }): Promise<void> {
  await page.goto("/covers/add");
  const agree = page.getByRole("checkbox");
  if (await agree.isVisible().catch(() => false)) {
    await agree.check();
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await page.getByTestId("policy-type").selectOption("personal_health");
  await page.getByTestId("schedule-input").setInputFiles({ name: file.name, mimeType: "application/pdf", buffer: file.buffer });
}
