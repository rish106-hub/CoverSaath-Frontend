# Knowvia web app

Health insurance helper for Indian families. Next.js 16 app on port 3200. Phase 1: every screen runs on mock adapters with synthetic data (the Meera Rao household). Beta access and the signed-in person come from the local backend through a server-side BFF.

```sh
npm ci
cp .env.example .env.local   # fill the three names below; never commit it
npm run dev                  # http://localhost:3200
```

| Command | Use |
| --- | --- |
| `npm run typecheck` / `lint` / `test` / `build` | the four required checks |
| `npm run dry-run` | end-to-end proof of frontend, BFF, backend and database (needs the backend running on 8787) |
| `npx playwright test` | keyboard, mouse and voice walks in `e2e/` on a mock-adapter server at 3201 (needs `npx playwright install chromium`) |

Environment variable names only: `KNOWVIA_API_URL`, `KNOWVIA_BOOTSTRAP_TOKEN`, `SESSION_COOKIE_SECRET`, optional `NEXT_PUBLIC_ADAPTERS=mock`.

## Routes

| Group | Routes |
| --- | --- |
| Public | `/` beta access, `/signin`, `/welcome` and `/welcome/add`, `/welcome/reading`, `/welcome/people`, `/welcome/ready`, `/status` (dev only) |
| My cover | `/home`, `/policies`, `/policies/[id]`, `/stress-test`, `/compare`, `/review` |
| My family | `/family`, `/cards` |
| My money | `/money`, `/tools` |
| Help | `/desk`, `/emergency`, `/assistant` |
| Account | `/shortcuts`, `/settings` |

The route list and page headings live in `src/lib/ia.ts`; nav, headers and tests read from it.

## Ask Knowvia, shortcuts, palette

- Dock on every app page, card next to its trigger, Home strip under the greeting. Hold `V` to talk, `/` to type, `Esc` closes. Rules in `src/agent/classify.ts`; page knowledge in `src/agent/page-registry.ts` (resolved from the pathname, so a new route only needs an entry there).
- Pages ask the card a question by dispatching `new CustomEvent("knowvia:ask", { detail: { text } })` on `window`.
- `Cmd/Ctrl K` palette. `G` then `H P S C M D F` go to a page; `E` emergency, `N` add a document, `T` theme, `?` shortcut overlay.
- Page keys (`J K Enter`, `1-5` person, `1-4` plan, `A`/`C` on Things to check) are defined once in `src/lib/shortcuts.ts`, broadcast as the `knowvia:shortcut` window event, and consumed with `usePageShortcuts({ next, prev, "person-1", ... })`. Tests use `pressPageShortcut(id)`.
- Shortcut text is never shown on pages; the full map is on `/shortcuts` and built from the same data.

## Adapters

Screens import from `src/adapters` only (never `src/adapters/mock/*`). `types.ts` holds the interfaces, `schemas.ts` the zod schemas every adapter result is checked against, `mock/` the implementations, `backend.ts` the two real ones (access, household).

| Adapter | Today |
| --- | --- |
| access, household | BFF to the backend (mock when `NEXT_PUBLIC_ADAPTERS=mock` or under test) |
| auth, document, reading, policy, assistant, voice, email, reconcile, desk, hospital, blood, learn, invite, wallet, notify | mock, marked `// backend gap` where the backend has no tables yet |

### Real mode (signed-in accounts other than the demo login)

| Screen | Real data | Source |
| --- | --- | --- |
| `/home` | Stored holdings and their key facts, pending conflicts, empty state to `/covers/add` | `GET /api/app/covers/holdings`, `.../facts`, `.../conflicts` via `src/adapters/real-policy.ts` |
| `/policies` | Holdings with key facts and stage (reading, choose plan, ready, needs review) | same |
| `/policies/[id]` | Facts by group: value, status as the backend gave it, citation (source tier and page) where returned | same |
| `/covers/add`, `/covers/review`, `/covers/declarations` | Real | covers adapter |
| `/chat`, `/hospitals` | Real | chat and covers adapters |
| `/family`, `/settings`, onboarding | Real | household, members, user-data adapters |
| `/stress-test`, `/compare`, `/money`, `/tools`, `/desk`, `/emergency`, `/cards`, learn | Empty collections (`// backend gap` in `src/adapters/real.ts`) | none |

Not returned by the holdings routes, so not shown in real mode: sum insured, premium and renewal date as typed fields, the confirmed insurer or product name (shown only if a confirmed `product_name` or `insurer_name` fact exists), the document kind of a citation, and a document-level "processing failed" status.

### Swap a mock for a real API

1. Add the BFF route under `src/app/api/app/<name>/route.ts` using `src/server/backend/*` (server-only, 5 s timeout, coded errors, no token to the browser).
2. Write the client in `src/adapters/backend.ts` returning the same type, parse with the schema from `schemas.ts`.
3. In `src/adapters/index.ts` select it the same way `access` and `household` are selected.
4. Delete the `// backend gap` comment on the mock it replaces. Screens do not change.

## BFF and dry run

`src/server/backend/*` (server-only) and `src/app/api/app/*` call `knowvia-api` on `KNOWVIA_API_URL`. The backend answers only loopback hosts and refuses browser origins, so nothing calls it from client code. The session lives in a sealed httpOnly cookie. `npm run dry-run` creates Meera Rao's household, reads it back and prints pass or fail per step without tokens.

## Structure

| Path | Holds |
| --- | --- |
| `src/app` | Next routes: `(app)` signed-in pages, public pages, `api/app` BFF handlers |
| `src/components` | UI by area: `agent`, `cover`, `family`, `money`, `help`, `shell`, `ui`, `theme` |
| `src/adapters`, `src/data/mock` | Adapter interfaces, mock and backend implementations, synthetic data |
| `src/server/backend` | Server-only BFF client, session cookie, user-data calls |
| `src/agent`, `src/lib`, `src/styles` | Ask Knowvia logic, pure helpers and calculators, design tokens |
| `tests` | Vitest, grouped like `src`: `app`, `components`, `agent`, `adapters`, `server`, `lib`, `styles` |
| `e2e`, `scripts` | Playwright walk; dry run, persistence check, bundle size |
| `design` | Design boards the UI is built from |
| `docs` | [build-spec](docs/build-spec.md), [decisions](docs/decisions.md), [persistence-matrix](docs/persistence-matrix.md), [keyboard-walkthrough](docs/keyboard-walkthrough.md), [deploy](docs/deploy.md) |

## Checks

Banned-words and route smoke tests render every route (`tests/app/routes.test.tsx`); contrast tests cover both themes plus the Emergency fixed colours (`tests/styles/tokens.test.ts`); the shortcut map has a collision test (`tests/agent/agent.test.ts`). CI runs typecheck, lint, test, build, dependency audit, secret scan and the Playwright walk on every push; CodeQL runs weekly. Deploy, env vars, post-deploy smoke and scale limits: [docs/deploy.md](docs/deploy.md).
