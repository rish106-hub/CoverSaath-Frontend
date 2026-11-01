import { defineConfig } from "@playwright/test";

// Run with `npx playwright test` after `npx playwright install chromium`. Starts the app on 3200 if it is not already up.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3200", viewport: { width: 1280, height: 800 } },
  webServer: { command: "NEXT_PUBLIC_ADAPTERS=mock npm run dev", url: "http://localhost:3200", reuseExistingServer: true, timeout: 120_000 },
});
