import { defineConfig } from "@playwright/test";

// Run with `npx playwright test` after `npx playwright install chromium`.
// Starts its own mock-adapter dev server, so it never touches a real session on 3200.
// The port comes from KV_E2E_PORT so parallel runs in other worktrees do not share a server.
const port = process.env.KV_E2E_PORT ?? "3201";

export default defineConfig({
  testDir: "e2e",
  testIgnore: /real-.*\.spec\.ts$/,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1280, height: 800 } },
  webServer: {
    command: `NEXT_PUBLIC_ADAPTERS=mock npx next dev -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
