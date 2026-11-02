# Deploy and operate (Vercel)

Production: `https://knowviafrontend.vercel.app` (Vercel, region `syd1`, set in `vercel.json`).
The BFF is the only caller of the backend (`https://knowvia-api.fly.dev`). The browser never talks to `/api/v1`.

## Environment variables (Production, and Preview if used)

| Name | Value | Notes |
| --- | --- | --- |
| `KNOWVIA_API_URL` | `https://knowvia-api.fly.dev` | No trailing slash. |
| `KNOWVIA_BOOTSTRAP_TOKEN` | same value as the Fly secret | Mark Sensitive. |
| `SESSION_COOKIE_SECRET` | 32+ random characters | `openssl rand -base64 48`. Mark Sensitive. Rotating it signs everyone out. |

Missing any of them makes every `/api/app/*` route answer `503 {"code":"CONFIG_MISSING"}`.
Never set `NEXT_PUBLIC_ADAPTERS=mock` in Production.

## Checks

**Before production (CI, `.github/workflows/ci.yml`, runs on every PR and push to main)**
typecheck, lint, unit tests, production build, `npm audit` (high and above), gitleaks, Playwright e2e. CodeQL runs on PRs and weekly. Dependabot opens weekly update PRs.
Make `check`, `audit`, `secrets` and `e2e` required status checks in the GitHub branch protection for `main`.

**During (Vercel)**
Every PR gets a Preview deployment. Promote only a green build. Instant Rollback from the Vercel dashboard restores the previous deployment in seconds.
Security headers and CSP come from `next.config.ts` and are covered by `tests/app/security-headers.test.ts`.

**After (`.github/workflows/post-deploy.yml`)**
`scripts/smoke.mjs <url>` runs on each successful deployment, on demand, and every 30 minutes against production.
It checks the sign-in page, security headers, `/api/health`, that the BFF answers coded JSON (not `CONFIG_MISSING`, not a 5xx) and that dev-only routes are hidden.
Vercel Speed Insights collects real-user Core Web Vitals (enable it in the Vercel project, Speed Insights tab).

Manual smoke after the env vars are set: beta access, `/home` shows the backend name, open the main pages and expect no 4xx/5xx, sign out.

## Scale: what is and is not true

- The frontend (static pages, Next on Vercel's edge network and serverless functions) scales horizontally on its own.
- The backend is **one Fly machine** (`knowvia-api`, Sydney). Its rate limit, model budget and evidence-claim guard are in-process, so a second machine would multiply those limits instead of sharing them. No capacity number has been measured, so there is no supported claim of "millions of requests". Do not make one.
- To measure: `node scripts/soak.mjs <baseUrl> --total 2000 --concurrency 50` against a staging deployment, then record latency percentiles and error rate here.
- Before adding Fly machines, move the rate limit and budget to shared storage (backend ADR needed).

## Overload behaviour (what happens when the backend is slow or down)

The site must degrade, not crash. Every backend call from the BFF passes `src/server/backend/resilience.ts`:

- **Bulkhead:** at most 32 backend calls in flight per serverless instance. Extra calls fail at once instead of queueing until the platform timeout.
- **Circuit breaker:** 5 failures in a row (network error, timeout, 5xx) open the circuit for 10 s. Calls fail at once, then one probe call decides whether it closes.
- **Fast failure** is `503 BACKEND_BUSY` with `Retry-After: 5` and `no-store`. The body is coded and holds no internals.
- **Browser:** reads (GET) retry up to 2 times on a network error or 502/503/504, waiting for `Retry-After` (capped at 3 s) or a jittered backoff. Writes are never retried automatically.
- Pages that do not need the backend (sign-in shell, static content, `/api/health`) keep serving while the backend is down.
- Error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`) catch render failures.

Limits: breaker and bulkhead state is **per instance**. It lowers pressure on the backend but is not a global cap, so many Vercel instances can still send more than 32 calls in total. A true global limit needs shared storage and is part of the same backend work as the shared rate limit.
