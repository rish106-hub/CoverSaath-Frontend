# Stability notes

## 1. Reload / loop audit (static; no browser was available)

Established facts: the dev server logged about 600 `GET /` each followed by `Compiled in Nms` with no source change; with curl only there was no recompiling. The loop is driven by a browser tab running the dev HMR client, not by the server or backend. The production build (`next build` + `next start`) has no HMR client.

Changes and findings:

- `next.config.ts:allowedDevOrigins` added (localhost, 127.0.0.1, LAN patterns). A tab opened from an origin Next does not recognise cannot keep the HMR websocket, and the client reloads the page instead. Dev only.
- Hydration: `src/components/shell/HomeGreeting.tsx:14-21` reads `new Date()` only inside an effect, so server and first client render match. `src/components/help/SettingsView.tsx:55-60` reads localStorage after mount. `src/components/theme/ThemeProvider.tsx:16-21` syncs theme in an effect; the init script (`ThemeProvider.tsx:12`) only mutates `<html data-theme>`, which has `suppressHydrationWarning` (`src/app/layout.tsx:19`). `useReducedMotion` uses `useSyncExternalStore` with a server snapshot. No render-time `window`/`Date`/`localStorage` reads were found in `src/components`.
- Self-retriggering effects: none. `useMe` (`src/components/shell/useMe.ts`) re-runs only when retry is called. `CommandPalette.tsx:21-27` depends on `paletteOpen` only. `AgentProvider.tsx` timers are started from event handlers, not effects. The one real gap: the `AgentProvider` reply interval (`AgentProvider.tsx:79`) was not cleared on unmount; fixed in task 4/5.
- Navigation on mount: none. `router.push` is only called from handlers (`AccessCard.tsx:40,54`, `Flow.tsx:24`, `CommandPalette.tsx:30`, `HomeView.tsx:78`, `SettingsView.tsx:180`, `AgentProvider.tsx:183`). No `router.refresh`, `location.reload`, or `redirect()` in `src`.
- Request fan-out: four components called `useMe()` independently (`Welcome.tsx:10`, `FamilyOwner.tsx:11`, `HomeGreeting.tsx:14`, `SettingsView.tsx:52`), each fetching `/api/app/me` on every mount. Replaced by a shared store (task 2). A reload loop multiplies this, which is why the log showed ~237 `/me` calls.

## Soak

`node scripts/soak.mjs <baseUrl> [--pid N] [--total 2000] [--concurrency 50]` against a running `next start`. Prints p50/p95/p99 latency, error count, and server RSS when a pid is given.

## Size budget

`npm run analyze:size` prints first-load JS (gzip) per route from `.next` after `next build`. Budget: 300 kB gzip per route; enforced by `tests/size-budget.test.ts` when `.next` exists.
