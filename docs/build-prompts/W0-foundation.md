<task id="W0" branch="feat/w0-dry-run" model="sonnet-5.5" effort="medium">
Lay the foundation every other run builds on, stitch every route together, and prove the frontend ↔ backend ↔ database dry run (BUILD-SPEC section 13). Work in the worktree you were given, on branch `feat/w0-dry-run`.

<build>
1. Dependencies: add `motion`, `cmdk`, `zod`, `simple-icons`; dev: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test` (do not install browsers). Scripts: `dev` (port 3200), `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`).
2. `src/styles/tokens.css`: every colour, group colour, recommendation style, radius, shadow, motion token from BUILD-SPEC section 3, for `[data-theme=light]` and `[data-theme=dark]`. Dark values: hand-pick so every text/surface pair is ≥ 4.5:1.
3. Fonts via `next/font/google` (Newsreader, Geist, Geist Mono) in `src/app/layout.tsx`.
4. `src/components/theme/`: `ThemeProvider` (persist in localStorage, wrapped in try/catch, default light, no flash on load), `ThemeToggle` (bottom-left, `◐ Dark`/`◐ Light`; the `T` key binding comes in W1).
5. `src/components/type/`: `PageTitle`, `Kicker`, `SectionHeading` (20/600 + description + 1 px rule; `actions` slot on the right), `SubHeading`, `Recommended` (lilac block + chip).
6. `src/components/shell/`:
   - `GroupNav` data in `src/lib/ia.ts` (4 groups, pages, routes, colours: BUILD-SPEC section 4).
   - `PageHeader` (breadcrumb + group switch + underlined tabs), exactly as the header at the top of `design/Compare.dc.html` (`.phead`, `.prow`, `.crumbs`, `.gsw`, `.ptabs` CSS in its `<style>`).
   - `HomeSidebar` (grouped nav as in `design/Home.dc.html` `<aside>`, plus Emergency link, Today block, reading list).
   - `AppShell` (header or sidebar, main, slot for the Ask Knowvia dock, theme toggle).
   - Route group `src/app/(app)/layout.tsx` using `AppShell`; public routes outside it.
7. `src/components/logos/`: `BrandLogo` (simple-icons by id, own brand colour, white tile) and `OfficialLogo` (file in `public/logos/<id>.svg|png` if present, else neutral name tile). `public/logos/README.md` listing the files the owner must supply (DigiLocker, ABDM/ABHA, e-RaktKosh, Outlook, Teams, insurers).
8. `src/adapters/`: every interface in BUILD-SPEC section 9 with zod schemas, a `mock/` implementation each (in-memory, small artificial delays), and `src/adapters/index.ts` exporting the active set.
9. `src/data/mock/household.ts` and siblings: the full Meera Rao household and every dataset the boards use (copy values from the board scripts).
10. Placeholder pages for every route in BUILD-SPEC section 4 using the shell, so W1–W5 replace content only.
11. Tests: tokens contrast (both themes), `ia.ts` (every route belongs to exactly one group), adapters return schema-valid data.
12. **Stitch**: every route in BUILD-SPEC section 4 reachable from the shell (page header tabs, group switch, Home sidebar, Emergency link); each placeholder shows its page title, kicker and its section headings from the board (empty sections allowed, no lorem).
13. **Dry run** (BUILD-SPEC section 13): `src/server/backend/` client (server-only, 5 s timeout, coded errors), sealed httpOnly session cookie, BFF routes `POST /api/app/access`, `GET /api/app/me`, `POST /api/app/signout`, `GET /api/app/status`; `AccessAdapter` and `HouseholdAdapter` get a `backend` implementation selected in `src/adapters/index.ts`; the beta form on `/` (minimal version of the Landing board's access card is enough here; W2 builds the full page) submits Meera Rao / meera.rao@company.com; `/home` greeting + sidebar + avatar and `/family` owner card read from `GET /api/app/me`; `/status` page; `scripts/dry-run.ts` + `npm run dry-run`; backend-down state. `.env.example` with names only.
14. Never read, print or commit `.env.local` or the backend repo's env files. If `.env.local` is missing, stop the dry-run step and report exactly which names the owner must fill; everything else must still build and test (mock adapters).
15. Run `npm run dry-run` against the live backend at `http://127.0.0.1:8787` if `.env.local` exists, and include its pass/fail output (no tokens) in your report. Do not touch the backend repo, its database directly, or the test database `coversaath_dev`.
16. `docs/decisions.md` (start it). Commit in small slices on your branch. No remote, no push.
</build>

<owns>src/server/**, src/app/api/app/**, src/app/status/**, scripts/**, .env.example, package.json, lockfile, config files, src/app/layout.tsx, src/app/(app)/layout.tsx, src/styles/**, src/components/{theme,type,shell,logos}/**, src/lib/ia.ts, src/adapters/**, src/data/**, public/logos/**, placeholder pages.</owns>
</task>
