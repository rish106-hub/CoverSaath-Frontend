# Knowvia app: build spec v2 (design approved 2026-11-01)

Source of truth for the build. Read with `design/*.dc.html` (17 design boards). Where a board and this file differ, this file wins; where this file is silent, copy the board. The product name is **Knowvia**, the assistant is **Ask Knowvia**.

Phase 1 starts with the **dry run** (section 13): the app talks to the real local backend through a server-side BFF for everything the backend already stores; the rest stays behind mock adapters until the backend has tables for it. Every external dependency sits behind an adapter with a mock, so phase 2 swaps in real APIs (Knowvia backend via a BFF, Gmail, DigiLocker, e-RaktKosh, ABDM HFR, Maps, WhatsApp, calendars) without touching screens.

---

## 1. Principles (owner)

1. **Calm, not intimidating.** Everything sits in 4 groups (section 4). Pages are segmented: page header, ruled section headings, short grey descriptions. Show only what needs the user; say what Knowvia already handled as a count, not a list.
2. **Ask Knowvia everywhere.** The voice agent is on every app page, reads the current page and the user's policies, answers, acts, and navigates.
3. **The user just talks; the AI classifies.** No "is this correct?" chores. User-centric words on screen, never variable names (`ask_policy` never appears in UI).
4. **One input mode end to end.** Keyboard-only, mouse-only and voice-only each complete every flow. Shortcuts work everywhere but are **not printed on pages** (no hint text like "G C · Compare · 1–4"); they live in the `?` overlay and the Shortcuts page. Only the voice dock shows `Hold V`.
5. **Professional segmentation** (Mobbin references: Snowflake, Klaviyo, Shopify, Ramp). No pill/circle eyebrow labels, no stacked "headline" category rows, no tiny grey monospace labels.
6. **Light by default; dark optional on every page** (toggle button + `T`). Every page, Emergency included, must be fully legible in both. Never light text on light boxes.
7. **Recommendations look different.** Anything Knowvia recommends uses the lilac style (section 3) with a "Recommended" label, so users know what to check and edit.
8. **Confident copy.** No "sample", "demo", "preview", "draft", "not advice", "not an insurer". No invented user counts, ratings, testimonials or press.
9. **Laptop-first** for 13–14 inch screens (1280–1440 wide, about 800 tall above the fold); fluid to tablet; phone layouts later (must not break, need not be designed yet).

---

## 2. Stack

- Next.js 16 (App Router) + React 19 + TypeScript strict. Already scaffolded (`package.json`).
- CSS Modules + one `src/styles/tokens.css`. No Tailwind.
- `motion` (v12) for animation; respect `prefers-reduced-motion`.
- `cmdk` for the command palette. `zod` for adapter schemas.
- Charts: hand-written SVG. No chart library.
- Voice: Web Speech API behind `VoiceAdapter`; unsupported browsers open the same card with a text field.
- Fonts via `next/font/google`: Newsreader (page titles and hero numbers only), Geist (all UI, section headings, stat numbers), Geist Mono (policy refs like `p.4 §3.2` only).
- Brand logos: `simple-icons` (npm, CC0) rendered as inline SVG through `<BrandLogo id>`: Google, Apple, Gmail, WhatsApp, Telegram, Google Chat, Signal, Slack, Google Messages, YouTube, Google Maps, Samsung, Google Calendar. Government marks (DigiLocker, ABDM/ABHA, e-RaktKosh) and Microsoft (Outlook, Teams) render as a neutral name tile until the owner drops approved files in `public/logos/` (`<OfficialLogo id>` picks the file up automatically). Insurer, TPA and hospital names are invented.
- Tests: Vitest + Testing Library. Playwright specs written; run only if browsers are already installed, else report "not run".
- Any other runtime dependency needs a line in `decisions.md`.

---

## 3. Design system

**Colours** (CSS variables): Paper #F7F5F0 (ground), Sheet #FFFFFF, Ink #16130F, Graphite #5F5A52, Muted #8C867C, Line #E6E1D7, Harbour #0E4F4A (primary), Sea glass #6FA79E, Mist #E3EFEC, Marker #F4DC8A, Ochre #E3B85A, Signal #E9785D (you pay, urgent), Coral #F2B9A8 (documents disagree).
**Recommendation**: background #EAE6F2, ink #4A3D78, border #CFC6EA, label chip "RECOMMENDED".
**Group colours**: My cover #0E4F4A, My family #B4553D, My money #8A5A0B, Help #5A4A8C.
**Dark mode**: a real token swap (`[data-theme=dark]`), not a CSS invert filter. Brand logos keep their own colours in both themes.

**Type scale**
| Use | Font | Size / weight |
|---|---|---|
| Page title | Newsreader | 44–52 / 400 |
| Hero stat number | Geist | 34 / 600, tracking −0.03em |
| Section heading | Geist | 20 / 600, with 1 px Line rule under the heading row, 12 px below |
| Sub-heading (inside cards) | Geist | 17 / 600 |
| Section description | Geist | 14 / 400 Graphite, 4 px under the heading |
| Body | Geist | 15 / 400 |
| Small text (minimum) | Geist | 13 / 400–500 Graphite. Nothing smaller except key caps |
| Kicker above page title | Geist | 14 / 500 Graphite (date, "Step 1 of 4") |

Radii 10/14/18/24. Soft long shadows. Motion 120/180/240/420 ms, `cubic-bezier(.2,.7,.2,1)`, no bounce. Contrast ≥ 4.5:1. Hit targets ≥ 44 px (≥ 32 px for chips inside dense rows). Real `<button>`, `<a>`, `<input>`, `<label>`.

---

## 4. Information architecture (approved)

Four groups, the same on every app page:

| Group | Pages (tabs) | Route |
|---|---|---|
| **My cover** | Overview · My policies · Stress test · Compare plans · Things to check | `/home`, `/policies[/id]`, `/stress-test`, `/compare`, `/review` |
| **My family** | People and invites · Cards and wallet | `/family`, `/cards` |
| **My money** | Money desk · Calculators and top-ups | `/money`, `/tools` |
| **Help** | Claims and insurer talks · Emergency · Ask Knowvia | `/desk`, `/emergency`, `/assistant` |

Public: `/` beta page, `/signin`. Onboarding: `/welcome/*`. Also `/shortcuts`, `/settings`.

**App shell**
- `/home` has the left sidebar grouped under the 4 bold group names (board `Home`).
- Every other app page opens with the **page header** (board `Compare`):
  - Row 1: breadcrumb `Knowvia / ● My cover / Compare plans` left; group switch (segmented control, 4 groups, current one white) right.
  - Row 2: the group's pages as underlined tabs; current tab 600 weight with a 2 px underline in the group colour; one 1 px Line under the whole row.
  - Both rows share the same left and right edges as the content below.
- Emergency is reachable from everywhere (`E`), keeps the header but stays visually minimal.

---

## 5. Global layer

### 5.1 Ask Knowvia (voice agent, mock in phase 1)
- **Dock**: bottom-centre pill on every app page: orb · "Ask Knowvia" · "Reads this page · {page}" · `Hold V`.
- **Home strip**: replaces any dark agent panel. One white row: orb + "Ask Knowvia anything. It reads your policies and whatever page you are on. Hold V and talk." + 3 example chips + "Doing for you: 2 in progress · 1 needs you →" (to `/desk`).
- **Card** (460 px, white, opens next to its trigger, never a full-page sheet): "Reading {what this page holds}" chip, state label (LISTENING… → WORKING ON IT → DONE · SAY THE NEXT THING), the transcript, 3 steps that tick, a green "Go to …" button when the answer lives on another page, "Try saying, on this page" with 3 page-specific examples, footer (V hold to talk · Esc close · English, Hindi or both).
- **Hold V**: keydown opens and listens, keyup submits. `Esc` closes. Ignored while an input is focused.
- **Page context**: each route registers `{page, reads, examples[3]}` (copy them from the `__voice()` data in each board's script). The agent answers from page data and household mock data, with page refs.
- **Classifier** `src/agent/classify.ts` (deterministic rules, English + common Hinglish: papa, mumma, dard, paise, admit, bill). Intents: emergency, explain_term, ask_policy, calculate, compare, add_document, payment, claim_help, family, navigate, remind, note, smalltalk. Emergency words route instantly. Output `{intent, person?, topic?, confidence, route?, reply, steps[3], actions[]}`. ≥ 5 phrasings per intent in tests. Intent names never appear on screen.
- `AssistantAdapter`, `VoiceAdapter` with mocks.

### 5.2 Shortcuts and command palette
- `⌘K`/`Ctrl K` palette: Go to, Ask Knowvia, Tools, People, Documents, Actions.
- Keys when no input is focused: `G H/P/S/C/M/D/F` go to, `E` emergency, `V` hold to speak, `/` type to Knowvia, `N` add document, `T` theme, `?` shortcuts overlay, `Esc`, `J/K` next/previous, `Enter` open, `1–5` person, `1–4` plan on Compare, `A`/`C` accept/change on Things to check.
- No shortcut text on pages (principle 4). One unit test asserts the map has no collisions.

### 5.3 Reminders and notifications
Reusable `<RemindRow label items>`: buttons with brand logos. Placements:
- Home → Your year: "Add all 4 dates": Google Calendar · Apple Calendar · WhatsApp reminder.
- Money → Coming up: "Renewals": same three.
- Family → Dates the documents give: "Put these dates on": same three.
- Desk → Thread: "Tell me when this case moves": WhatsApp · Email · Add the decision date (calendar).
Mock: Google Calendar opens a prefilled event URL; Apple Calendar downloads an `.ics`; WhatsApp/Email show a confirmation toast via `NotifyAdapter`.

### 5.4 Theme
Toggle button bottom-left on every page (`◐ Dark`/`◐ Light`, `T`). Persist per browser.

---

## 6. Screens (board → route)

| Board | Route | Must have |
|---|---|---|
| Landing | `/` | **One screen (≈ 940 px).** Left: kicker "Private beta · free while in beta", 40 px two-line headline, 3 icon points (Reads your policy in a minute · Shows what you would pay · Handles the follow-up), access card (Continue with Google, or name + email, "Get access"; Tab/Enter work), "No card needed. Leave any time." Success: "You're in, {name}" → `/welcome`. Right: "What you will see inside" 20-second tour of 5 app screens (auto-advance, pause/play, progress strip) + **"What Knowvia did for Meera's family this year"**: 4 clickable stats (Rs 75k tax saved · Rs 2.2L gap found early · 94% better-fitting plan · 22 min to admission), 34 px numbers, dividers, selected stat has a coloured top bar and drives the tour scene; one story line under it. Nothing else from the main Knowvia landing page. |
| Auth | `/signin` | Google, Apple, phone OTP (6 boxes, paste), email link. Insight cards on the right. |
| Onboarding | `/welcome/*` | Add (DigiLocker, upload, forward HR email, Gmail scan) with "Can't find your policy?" tips; Reading (live findings, never blank); People; Ready with **save card to wallet** (auto-detect Apple / Google / Samsung Wallet, plus share with family). |
| Home | `/home` | Grouped sidebar; Ask Knowvia strip; **Cover at a glance** full width (health ring + 6 tiles); then Needs your attention, Your year (date tiles + reminders), policies by type, cover per person, claims, money/desk previews, stress test + advisor, tools, learn. Priority order top to bottom. |
| Reading | `/policies/[id]` | Answer next to the clause, marker highlight, documents-disagree in coral. Page-ref line 13 px, not monospace hairline. |
| Policy | `/stress-test` | Person pills, 6 scenarios, bill waterfall, "you pay" with 3 levers, whole-family row, section bars, strong / watch-out. Logic in `src/lib/stress.ts` (top-up rules as in the board script `calc()`). |
| Compare | `/compare` | Priority chips (Off/Low/Medium/High) drive fit scores; verdict; plan cards; best fit in **Recommended** lilac; section table; "Same bill, four plans"; registered advisor; buy direct. |
| Audit | `/review` | "N things need you. Knowvia handled the rest." + ring (done of 44). Lilac "Recommended · check and edit" decisions (Accept / Edit / options, Accept all). "New this round" list (Open / ✓ / Change). Never list what was auto-resolved. |
| Family | `/family` | Person cards; **Family on Knowvia** invites (Joined / Invite sent / Not invited); add-member sheet (relation, name, mobile → send on WhatsApp / SMS); policy by person; gaps; dates + reminders; who sees what. |
| Wallet | `/cards` | E-card pass, add to Apple / Google / Samsung Wallet (auto-detect), share. |
| Money | `/money` | Gmail scan, receipts, expected, coming up + reminders, by person, bill vs paid, month chart, money on its way back, what Knowvia did, **Premium and cover, years ahead** (inflation 10–16 %, default 12 %, editable; treatment cost vs cover line vs premium; lilac recommendation). Logic in `src/lib/inflation.ts`, `src/lib/reconcile.ts`. |
| Tools | `/tools` | 80D, room rent, exit-papers checklist, **top-up finder** (case by case, Recommended lilac), **registered advisors**. |
| Desk | `/desk` | Scoreboard, cases with steps, thread + notify row, escalation ladder, who we're talking to, live feed. |
| Emergency | `/emergency` | **Light** (fully, including e-card and buttons). Person pills, Call 112 / 108 / TPA / Share location, e-card (white, Harbour top edge, Show QR, Send to WhatsApp), desk checklist, best hospital now (location → ranked list + map), blood near you. |
| Assistant | `/assistant` | "How Knowvia understands you" in plain words; try-saying list. |
| Shortcuts | `/shortcuts` | Full keyboard map and single-input paths. |

`Main.dc.html` is the direction brief, not a route.

---

## 7. Motion and engagement
Route content fades/slides 12 px in 240 ms. Numbers count up on first view; charts grow from zero. Long operations show content-rich progress, never a bare spinner. Empty states have one action. Reduced motion: fades only, no auto-advance.

## 8. Mock data
`src/data/mock/household.ts`: Meera Rao (41, Pune), Rohan (43), Kabir (8), Mother, Father; Northstar Health group floater Rs 5L, Kaveri super top-up Rs 10L after Rs 5L, Meridian Care senior plan Rs 3L each (20 % co-pay; documents disagree on room rent); receipts, desk cases, hospitals, blood stock, learn posts, invites (Rohan and Mother joined, Father sent, Priya not invited). All invented and consistent with the boards.

## 9. Adapters (phase-2 seams)
`src/adapters/` interfaces + `mock/`, chosen in `src/adapters/index.ts`; screens import only from `src/adapters`:
`AuthAdapter`, `AccessAdapter` (beta sign-up: name + email → creates the user; phase 2 calls the backend so the account exists in the main database), `DocumentAdapter`, `ReadingAdapter`, `AssistantAdapter`, `VoiceAdapter`, `EmailAdapter`, `ReconcileAdapter`, `DeskAdapter`, `HospitalAdapter`, `BloodAdapter`, `LearnAdapter`, `PolicyAdapter`, `HouseholdAdapter`, `InviteAdapter` (family invite by mobile), `WalletAdapter`, `NotifyAdapter` (WhatsApp / email / calendar).
Phase 2 BFF: same-origin `/api/app/*`, sealed cookies, CSRF marker, server-side calls to the backend (it rejects browser origins; no CORS). Reuse from `Knowvia_website` branch `feat/ui-app` (`src/server/app/*`, `src/app/api/app/*`).

## 10. Checks
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass.
- Unit tests: classifier, stress math, reconcile, inflation planner, calculators (80D old regime: Rs 25k self; Rs 25k or 50k parents if senior), shortcut map, adapters schema-valid (zod), theme tokens (every text/background pair ≥ 4.5:1 in both themes).
- Banned-words test over rendered text of every route: sample|demo|preview|draft|placeholder|lorem|not advice|not an insurer|CoverSaath|Saath (except inside "Ask Knowvia" history) and raw intent names.
- Keyboard-only walk documented in `keyboard-walkthrough.md`.
- Visual check at 1280×800 and 1440×900: no horizontal scroll, header rows aligned, nothing clipped.

## 11. Repo and delivery
- Remote: github.com/rish106-hub/CoverSaath-Frontend.
- `npm run dev` on port 3200. README: routes, shortcuts, adapters, how to swap to real APIs.

## 12. Phase 2 (not now)
Stress test the frontend (Playwright, Lighthouse, usability), then connect auth, beta access (account in the main DB), documents and reading, profile answers, then backend gaps.

## 13. Dry run: frontend ↔ backend ↔ database (first build slice)

Goal: prove the three layers are aligned before building every screen. Seed user: **Meera Rao, meera.rao@company.com** (synthetic).

**Backend (already running locally):** `knowvia-api` at `http://127.0.0.1:8787`, local PostgreSQL. It accepts calls only from loopback hosts and rejects browser origins: every call goes **server-side** through the BFF. Never call it from client components.

**What the backend stores today, and how the app uses it**

| App need | Backend route | Notes |
|---|---|---|
| Beta access (name + email) creates the account | `POST /api/v1/households` with `Authorization: Bearer <bootstrap token>`, body `{displayName: "Rao family", owner: {displayName, contactEmail, locale: "en-IN"}}` → `{household, owner, ownerMember, session}` | BFF only. Store `session` token + household id in a sealed httpOnly cookie. |
| Who is signed in, household, members | `GET /api/v1/households/{id}` with the session bearer | Drives greeting, sidebar, avatar, Family "People" owner card. |
| Health / readiness banner | `GET /api/v1/health`, `GET /api/v1/ready` | Status page `/status` (dev only). |
| Connected sources status | `GET /api/v1/integrations` | Settings → connected sources. |
| Sign out | `POST /api/v1/sessions/current/revoke` | Clears the cookie. |

**Not stored by the backend yet** (stay on mock adapters, each mock marked in code with `// backend gap`): family members beyond the owner and invites, policies and their facts (needs documents + reading pipeline, phase 2), receipts and payments, renewals and dates, desk cases with insurers/TPAs, hospitals, blood stock, learn posts, wallet passes, reminders. These need new backend tables and migrations, which are a separate, owner-approved backend task.

**BFF** (`src/server/backend/*`, route handlers under `src/app/api/app/*`): same-origin only, `server-only` imports, timeouts (5 s), coded client-safe errors, no token ever sent to the browser or logged. Config from `.env.local` (owner fills it; never read, print or commit it): `KNOWVIA_API_URL=http://127.0.0.1:8787`, `KNOWVIA_BOOTSTRAP_TOKEN=<same value as the backend's>`, `SESSION_COOKIE_SECRET=<32+ random chars>`. Ship `.env.example` with the names only. Reuse patterns from `../Knowvia_website` branch `feat/ui-app` (`src/server/app/*`, `src/app/api/app/*`) where they fit.

**Dry-run acceptance**
1. `npm run dev` (port 3200) with the backend running.
2. On `/`, submit Meera Rao / meera.rao@company.com → BFF creates the household in the database → "You're in, Meera" → `/welcome` → `/home`.
3. `/home` greeting, sidebar and avatar show the name **read back from the backend** (not from the form). `/family` shows Meera as the owner member from the backend.
4. `/status` shows backend health, readiness, and the household id (dev only).
5. A script `npm run dry-run` does the same end to end server-side and prints pass/fail per step (no tokens in output).
6. With the backend stopped, the app shows a calm "Can't reach Knowvia right now" state, never a crash.
