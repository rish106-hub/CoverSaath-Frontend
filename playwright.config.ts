import { defineConfig } from "@playwright/test";

// Run with `npx playwright test` after `npx playwright install chromium`.
// Starts its own mock-adapter dev server on 3201, so it never touches a real session on 3200.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3201", viewport: { width: 1280, height: 800 } },
  webServer: {
    command: "NEXT_PUBLIC_ADAPTERS=mock npx next dev -p 3201",
    url: "http://localhost:3201",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
