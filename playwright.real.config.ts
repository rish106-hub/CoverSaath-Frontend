import { defineConfig } from "@playwright/test";

// Playwright config for the real-account screens harness (e2e/real-screens.spec.ts). Exists because the mock config serves the demo
// adapters, so real-account screens never render there. Any NEXT_PUBLIC_ADAPTERS value other than "mock" puts the browser adapters in
// backend mode: they call /api/app/*, which the spec answers with synthetic data. No backend address is given to the server.
// Own port and its own server (never reused), so a stale server from another checkout cannot be picked up.
const port = process.env.KV_E2E_PORT ?? "3312";

export default defineConfig({
  testDir: "e2e",
  testMatch: "real-screens.spec.ts",
  // Screenshots go to test-results/real; Playwright empties its output directory at the start of every run, so keep it apart.
  outputDir: "test-results/real-output",
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `NEXT_PUBLIC_ADAPTERS=backend npx next dev -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
