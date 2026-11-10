# Analytics proxy (F5)

Status: FOR LEGAL REVIEW. Engineering record, not legal advice. Off by default.

## Shape
- The browser posts `{ event, properties }` to `POST /api/app/ingest` (same-origin, `x-knowvia-app: 1`). It never talks to PostHog.
- The route forwards to PostHog server side (`POSTHOG_HOST`, EU cloud first; host must be on the list in `src/server/analytics/config.ts`).
- Consent: `POST /api/app/analytics/consent` with `{ "choice": "granted" | "denied" }` sets or clears the `kv_analytics` cookie (see `docs/cookie-inventory.md`). No cookie, no forward. Flag off, no forward. Both answer 204 and read nothing.
- PostHog gets only a body built from scratch: allow-listed event, allow-listed enum/boolean properties, a random anonymous id from the consent cookie, `$process_person_profile: false`, `$geoip_disable: true`. No cookies, IP, user agent or referrer are forwarded. No autocapture, no session replay.

## Allow-list
`src/server/analytics/policy.ts` is the only place events and properties are declared. Strings are enums; there is no free text, URL, path, id, policy content or household data. Unknown event: 400 `INVALID_INPUT`. Unknown property or value: dropped. Change it only with a test in `tests/server/analytics.test.ts`.

## Environment (names only)
`ANALYTICS_ENABLED` (must be exactly `1`), `POSTHOG_PROJECT_KEY`, `POSTHOG_HOST`. Values are set by the owner in the host environment; none are in the repo. No PostHog account is created by this change.

## Before turning it on
- The backend S5 notices (`GET /api/v1/notices`, backend PR #72) define the disclosed purposes. Analytics must be itemised there as a purpose, with legal basis and retention, before `ANALYTICS_ENABLED=1` in any real environment. Until then keep it unset.
- Add a processor contract for PostHog and a consent choice UI whose wording legal has approved.
- The page CSP stays `connect-src 'self'`; no change is needed because the browser only calls this app.
