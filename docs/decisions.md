# Decisions

Short log of choices that go beyond BUILD-SPEC.

- 2026-11-01 W0: `motion` resolved to v14 (npm latest); spec said v12. API used later is the same (`motion/react`). Revisit if W1 hits a break.
- `server-only`: marks BFF modules so they cannot reach client bundles. Tiny, official.
- `tsx` (dev): runs `scripts/dry-run.ts` with the real BFF modules via `--conditions=react-server`.
- `@vitejs/plugin-react` (dev): JSX transform for Vitest.
- Group colour My family adjusted from #B4553D to #AE503A so it clears 4.5:1 on Paper (was 4.47). Muted #8C867C stays as a decorative token only; readable text uses Graphite. Signal and Coral get separate `-ink` text tokens.
- Slack is not in simple-icons any more: it renders as a neutral name tile via `OfficialLogo` until the owner supplies a file.
- Adapter selection: Access and Household use the BFF unless `NEXT_PUBLIC_ADAPTERS=mock` or under test; every other adapter is mock until the backend has tables (`// backend gap`).
- Session cookie `kv_session`: AES-256-GCM sealed (key = sha256 of SESSION_COOKIE_SECRET), httpOnly, SameSite=Lax, 7-day cap. State-changing BFF routes need header `x-knowvia-app: 1` and a matching Origin.

## W6 integration (merge of W1 to W5)

- Merge order: feat/agent, feat/public, feat/cover-home, feat/cover-policy, feat/family, feat/money, feat/help, each with `--no-ff`. Only append-only files conflicted (`src/adapters/mock/index.ts`, `src/data/mock/index.ts`); both sides were kept.
- Page contexts: one registry, `src/agent/page-registry.ts`, resolved from the pathname. Removed `components/public/context.ts`, `components/help/pageContexts.ts`, and the `moneyPageContext` and `toolsPageContext` copies in `data/mock`. Added `/` and `/signin` entries. Registry example text was kept; it already had the richer step data.
- Shortcuts: `components/help/shortcutTable.ts` removed; `/shortcuts` is built by `shortcutGroups()` from `src/lib/shortcuts.ts`. Page keys are consumed through one hook, `usePageShortcuts`, on the `knowvia:shortcut` event. `Shortcut.scope` may now list several routes (1-5 person works on Family, Stress test and Emergency).
- Slots: `AskKnowviaStripSlot` and the four `RemindRowSlot` files now render the real `AskStrip` and `RemindRow`; their props are unchanged. Reminder dates come from the mock data (`nextIso` turns "13 MAR" into the next such date after 1 Nov 2026).
- `knowvia:ask`: `AgentProvider` listens, opens the card in text mode and submits the phrase.
- `@/components/logos` is client-safe (BrandLogo only). `OfficialLogo` reads the filesystem and now lives behind `@/components/logos/server`.
- Emergency is light by default (root `data-theme="light"`); there is no forced dark theme. Its fixed colours (white e-card, call tiles) are covered by the contrast test in both themes.
- Copy fix found by the banned-words test: "Knowvia can draft the message" became "Knowvia can write the message".
- Playwright specs live in `e2e/`. `@playwright/test` was already a devDependency; browsers are not installed by this repo's setup.
