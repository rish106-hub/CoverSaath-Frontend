# Stability notes

## 1. Reload / loop audit (static; no browser was available)

Established facts: the dev server logged about 600 `GET /` each followed by `Compiled in Nms` with no source change; with curl only there was no recompiling. The loop is driven by a browser tab running the dev HMR client, not by the server or backend. The production build (`next build` + `next start`) has no HMR client.

Changes and findings:

- `next.config.ts:allowedDevOrigins` added (localhost, 127.0.0.1, LAN patterns). A tab opened from an origin Next does not recognise cannot keep the HMR websocket, and the client reloads the page instead. Dev only.
- Hydration: `src/components/shell/HomeGreeting.tsx:14-21` reads `new Date()` only inside an effect, so server and first client render match. `src/components/help/SettingsView.tsx:55-60` reads localStorage after mount. `src/components/theme/ThemeProvider.tsx:16-21` syncs theme in an effect; the init script (`ThemeProvider.tsx:12`) only mutates `<html data-theme>`, which has `suppressHydrationWarning` (`src/app/layout.tsx:19`). `useReducedMotion` uses `useSyncExternalStore` with a server snapshot. No render-time `window`/`Date`/`localStorage` reads were found in `src/components`.
- Self-retriggering effects: none. `useMe` (`src/components/shell/useMe.ts`) re-runs only when retry is called. `CommandPalette.tsx:21-27` depends on `paletteOpen` only. `AgentProvider.tsx` timers are started from event handlers, not effects. The one real gap: the `AgentProvider` reply interval (`AgentProvider.tsx:79`) was not cleared on unmount; fixed in task 4/5.
- Navigation on mount: none. `router.push` is only called from handlers (`AccessCard.tsx:40,54`, `Flow.tsx:24`, `CommandPalette.tsx:30`, `HomeView.tsx:78`, `SettingsView.tsx:180`, `AgentProvider.tsx:183`). No `router.refresh`, `location.reload`, or `redirect()` in `src`.
- Request fan-out: four components called `useMe()` independently (`Welcome.tsx:10`, `FamilyOwner.tsx:11`, `HomeGreeting.tsx:14`, `SettingsView.tsx:52`), each fetching `/api/app/me` on every mount. Replaced by a shared store (task 2). A reload loop multiplies this, which is why the log showed ~237 `/me` calls.

## Soak (scripts/soak.mjs)

```
npm run build && npx next start -p 3290 &        # never 3200: that is the owner's server
node scripts/soak.mjs http://localhost:3290 --pid $(lsof -ti tcp:3290 -sTCP:LISTEN)
```

Options: `--total 2000` (default), `--concurrency 50` (default), `--pid N` for server RSS. It round-robins every page route plus `/api/app/me`, prints p50/p95/p99/max, error count (5xx or failed), status mix, and RSS before/after/peak. A 503 from `/api/app/*` means the backend is not configured for that run and is reported apart, not as an error. Exit code 1 if any real error.

Measured on the author's Mac (production build, backend not configured): 2000 requests at 50 concurrency, p50 16.9 ms, p95 32.9 ms, p99 58.4 ms, 0 errors; RSS 55 MB to 212 MB. A 6000-request run: p99 31.9 ms, 0 errors, RSS 212 MB to 288 MB (still rising slowly; not shown to plateau).

## Size budget

`npm run analyze:size` prints first-load JS (gzip) per route from `.next` after `npm run build` and exits 1 above 300 kB. `tests/size-budget.test.ts` enforces the same when a build exists (it is skipped, not failed, when `.next` is absent). Static routes are measured from the script tags of the prerendered HTML; dynamic routes (`/status`, `/policies/[id]`, `/welcome/[step]`) from the client-reference manifest, which can undercount layout chunks.

## Other changes in this pass

- One shared `/api/app/me` store (`src/components/shell/useMe.ts`): in-flight dedupe, 30 s cache, focus revalidation at most every 30 s, stale-response guard. `invalidateMe()` runs on sign-in and sign-out.
- Error containment: `src/app/(app)/error.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`, `src/app/(app)/loading.tsx`.
- `useSingleFlight` (`src/lib/use-single-flight.ts`) on action buttons; `useTicker` pauses timers while the tab is hidden; `src/lib/capability.ts` plus `CapabilityInit` sets `data-motion="reduced"` for low-memory, low-core, save-data or reduced-motion devices.
- Lazy: landing Tour (sized skeleton), Ask card, Command palette, Wallet sheet.
- Lists: no list on any page exceeds 100 rows today (all mock-backed); the command palette now caps people and documents at 100.
