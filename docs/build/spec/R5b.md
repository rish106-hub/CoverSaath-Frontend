
## R5b Home and policy page match the approved canvas

Scope: Home and the policy page are rebuilt to the layout the owner approved on the canvas (Version 6), using only data the product really has. This section (kept in its own file from here on; earlier sections are in `docs/build/redesign-spec.md`) replaces R3d.2, R3d.3, R3e.3, R5a.4 and R5a.6. The My policies list keeps its R5a.5 look and gains the fit rules of R5b.7. The judge is the browser harness plus the unit suite.

Visual source (read before building; prototype code, copy no markup or copy that this section does not pin): `design/canvas-v6/screens-w.js` (the last `reg("home"` and `reg("policy"` registrations win), `design/canvas-v6/flat.css` (classes `.halves`, `.statp`, `.big0`, `.pcard`, `.pcard.next`, `.kv3`, `.rowt`), and the screenshots `design/canvas-v6/shots/home.png` and `design/canvas-v6/shots/policy.png`.

Persona served: a 25 to 35 year old tech worker with one or two health policies. Home tells them in one glance how much cover they have, when it renews and the one thing to do. A policy page shows the plan's three main numbers at the top and one group of details at a time, each with where it was read.

Not shown, because the product has no data for it: the "4 in 100" statistic, the e-card, the people on a policy, insurer logos.

### R5b.1 Files

| File | Change |
|---|---|
| `src/app/(app)/home/page.tsx` | Becomes `<DemoGate empty={<RealHome />}><><HomeGreeting /><HomeView /></></DemoGate>`. The real branch renders its own greeting. |
| `src/components/shell/HomeGreeting.tsx` | New optional prop `size?: "page" \| "line"` (default `"page"`, today's look). With `"line"` the `h1` uses a new class: Source Sans, 22px, weight 500, no top margin. Logic unchanged. |
| `src/components/shell/HomeGreeting.module.css` | New. The `.line` class. |
| `src/components/cover-real/RealHome.tsx`, `RealHome.module.css` | Rewritten (R5b.2). |
| `src/components/cover-real/RealPolicyDetail.tsx`, `policies.module.css` | Detail rewritten (R5b.3). |
| `src/components/cover-real/RealPolicies.tsx` | Fit rules only (R5b.7). |
| `src/components/cover-real/use-fit.ts` | New. `useFit` (R5b.7). |
| `e2e/real-calm.ts` | New. `expectCalm`, `expectNothingCutOff`, `SIZES` and the screenshot helper move here unchanged from `e2e/real-screens.spec.ts`, which imports them. |
| `playwright.real.config.ts` | `testMatch` becomes `/real-.*\.spec\.ts$/`. |
| `playwright.config.ts` | `testIgnore` becomes `/real-.*\.spec\.ts$/`. |
| `e2e/real-screens.spec.ts`, `e2e/real-account.ts` | Tests follow the new markup (R5b.4). No rule changes. |
| `tests/components/kv-home.test.tsx`, `kv-policies.test.tsx`, `t3-home.test.tsx`, `tests/adapters/real-policy.test.tsx`, `tests/components/real-policy-detail.test.tsx`, `wording-cutover.test.tsx`, `tests/app/routes.test.tsx`, other unit tests that fail only because of a change pinned here | Updated to the pinned markup. Titles are kept unless this section renames them. No test file is deleted. |

Not edited: `parts.tsx`, `MemoryDocument.tsx`, `PassageSearch.tsx`, `use-policies.ts`, adapters, `src/components/ui/*`, shared type and global styles, landing files, `package.json`.

### R5b.2 Home

`policies`, `first`, `next`, `policyHref`, `sumInsured`, `renewal` are computed as today. Loading, error and both empty branches keep their logic; each now renders `<HomeGreeting size="line" />` above its content.

Root `<div className={rows.page}>`: flex column, `gap: 24px`, `flex: 1`, `min-height: 0`. `<CreationIssues />` first, then two rows.

Row A `.halves`: two equal columns, `gap: 24px`, `flex: 1 1 0`, `min-height: 0`.

- Left (no card, content vertically centred): `<HomeGreeting size="line" />`, then `<h2 className={rows.sentence}>` with the three variants of R3d.3 item 1 (same text, same `data-testid="home-cover"` span in `var(--harbour)`). `.sentence`: Newsreader, 56px, line-height 1.04, weight 500.
- Right: `Card as="a" tone="inverse"` linking to `policyHref`, `data-testid="home-renewal"`, content vertically centred, padding 36px 40px.
  - With `renewal`: `<p className={rows.big}>{renewal.value}</p>` (Newsreader, 56px, weight 600, colour `var(--lime)`), then `Your next renewal.` (22px, weight 500), then `{first.title}` (18px, weight 600).
  - Without: `<p className={rows.big}>No renewal date yet</p>` at 40px, then `Open your policy to check its dates.`

Row B `.cards`: three equal columns, `gap: 24px`, `flex: 1 1 0`, `min-height: 0`. Every card has `overflow: hidden`, padding 28px, content in a column with the last item pinned to the bottom.

- Policy card (`Card as="a"` to `/policies/{id}`, `data-testid="home-policy"`, `aria-label={p.title}`): badge with the first letter of `p.insurer ?? p.title` (44px square, `var(--tide)` background, `var(--on-harbour)` text, radius 12px), `p.title` (18px, weight 600), `p.insurer` when set (18px, weight 500); the sum insured headline value when its tone is `read` or `confirmed` (Source Sans, 30px, weight 700), otherwise `Not found yet` at the same size; one `Signal` chosen exactly as the list's state row (R3e.2 item 3); an arrow `→` bottom right (`aria-hidden`, `var(--harbour)`, 26px, weight 700).
- Which cards: one policy gives [policy card] [Ask card] [next-step card]. Two or more give [policy card 1] [policy card 2] [next-step card]; with more than two, policy card 2 also carries the line `and {n - 2} more` (18px, weight 600) above its arrow, and no third policy is shown.
- Ask card (`Card`, one policy only): label `Ask about your cover` (18px, weight 600) and the two prompt links of R3d.3 (outline buttons, same hrefs).
- Next-step card (`Card tone="next"`): label `Your next step` (18px, weight 600); `<p className={rows.step}>{next.label}</p>` (Newsreader, 28px, weight 500); `{next.detail}` (18px, weight 500); a full-width primary link `data-testid="home-next"` to `next.href` whose text is chosen by `next.href`: starts with `/covers/review` gives `Decide now`; starts with `/covers/add` gives `Choose your plan`; otherwise `Ask now`.

Heights: under `@media (max-height: 860px)` the sentence and the big figure are 44px (the no-renewal text 32px), card padding 20px, gaps 16px, `.step` 24px. Under `@media (max-height: 639px)` `.page`, `.halves` and `.cards` lose `flex: 1` and `min-height: 0` (natural height), so the page scrolls instead of cutting content. No font under 16px, no weight under 500.

### R5b.3 Policy page

Loading, error and not-found branches are unchanged, as is the wording refresh effect.

Root `.detail`: grid, `grid-template-columns: minmax(0, 2fr) minmax(0, 1fr)`, `gap: 24px`, `flex: 1`, `min-height: 0`.

Left column (flex column, `gap: 16px`, `min-height: 0`):

1. Notices, only when they render something: `p.error ? <ErrorBox code={p.error} onRetry={reload} /> : <StageBox p={p} onRetry={reload} />` and `<Pending p={p} />`.
2. Header card (`Card`, padding 28px): when `p.insurer` is set, a chip line `<Signal kind="ok">{p.insurer}</Signal>`; `<h1 className={styles.name}>{p.title}</h1>` (Newsreader, 44px, line-height 1.05, weight 500); then, when there are headlines, `<ul data-testid="headlines">` in three equal columns, each `<li data-testid={`headline-${h.key}`} data-tone={h.tone}>` with the label (18px, weight 500) and the value (Source Sans, 26px, weight 700). Tone `review`: value `Two readings` stays as the adapter gives it, in `var(--warn-ink, var(--ink))`, with the link `Review and decide` to `/covers/review?holding={id}` under it. Tone `missing`: the adapter's value, with `<Signal kind="warn">Not found yet</Signal>` replacing nothing else. Tones `read` and `confirmed`: value only.
3. `Tabs` (`label="Policy sections"`): one tab per group that has facts (ids and labels as R3e.3), then `not-found` `Not found ({p.notFound})` when `p.notFound > 0`, then `terms` `Insurer terms` when the stage is `needs_review` or `ready`. There is no `At a glance` tab. The first tab in that order starts selected. With no tab at all, the line `Nothing has been read from this policy yet.` shows instead.
4. Panels: all in the DOM with `role="tabpanel"`, `data-panel`, `hidden` as before.
   - Group panel: `<ul className={styles.rows}>`, `FACT_PAGE = 6` rows per page, pager as before. Each `<li data-open={f.open}>` is one row in three columns (`minmax(0, 2fr) minmax(0, 3fr) minmax(0, 2fr)`), 1.5px bottom rule in `var(--line)`, min-height 54px: the label `f.label` (18px, weight 500); the value `f.value` (18px, weight 600; when `f.open` it is preceded by a yellow `Signal` dot and followed by `f.statusText`); the source `<span data-testid="fact-source">{f.citation ?? f.sourceText}</span>` (16px, weight 600, `var(--graphite)`, right-aligned). `FactItem` from `parts.tsx` is no longer used here.
   - `not-found`: as R3e.3.
   - `terms`: `<MemoryDocument holdingId={p.id} />` only; this panel alone may scroll inside itself.

Right column (flex column, `gap: 16px`, `min-height: 0`):

1. `<PassageSearch holdingId={p.id} />` when the stage is `needs_review` or `ready`.
2. `<TermsStatus p={p} onAdded={reload} />` under the same condition.
3. Links, each full width: `Ask about this policy` to `/chat?holding={id}` (primary) and `All policies` to `/policies` (outline).

Heights: under `@media (max-height: 860px)` the name is 36px, card padding 20px, row min-height 46px, gaps 12px. Under `@media (max-height: 639px)` the grid and columns take natural height so the page scrolls.

### R5b.4 Harness

- `e2e/real-calm.ts` holds the helpers; their bodies are moved, not changed.
- Tests 2, 5, 8, 12 and 13 fail before this task on measured rules; all of them pass after it.
- Test 1 keeps its title and also expects `home-renewal` and two `home-policy` cards for the default two-policy account.
- Test 6 is renamed `policy page shows the header card and switches fact groups`: it expects the `h1` product name, three headline cells, the first group tab selected, and a switch to `Waiting`.
- Test 8 is renamed `policy page is calm on every tab at every laptop size`.
- New test 18: `home with one policy shows the policy, ask and next-step cards`.
- Every other title is unchanged. All 18 tests pass, the measuring ones included: this task owns the fixes for Home, the list and the policy page.

### R5b.5 Unit tests

- `kv-home.test.tsx`: titles 5 and 6 (`the policies card links to My policies and lists at most two titles`, `a third policy shows and 1 more`) are replaced by `each of the first two policies is a card that links to its page` and `a third policy shows and 1 more on the second card`; titles 7 and 8 keep their names and assert the renewal panel (`home-renewal`): the date for found, `No renewal date yet` for missing; a new title 13 `the next-step button text follows where it leads`. Still no skipped test.
- `kv-policies.test.tsx`: `detail starts on At a glance with the stage note, pending note and headlines` becomes `detail shows the notices and the header card with three headlines`; `a group with nine facts pages at six` stays; a new title `a fact row shows its label, value and where it was read`.
- Other files: only what the pinned markup breaks.

### R5b.7 Nothing is ever cut off (measured by the harness)

The harness found content cut off at 1366x650, at 1280x560 and with long names. These rules apply to Home, the list and the policy page.

1. Text is never hidden by a fixed-height box. A box that cannot hold its content either gets fewer items (rule 2), scrolls inside itself (rule 4) or lets the page scroll (rule 5).
2. `use-fit.ts` exports `useFit(ref: RefObject<HTMLElement | null>, unit: number, min: number, max: number): number`: it measures the element's height with a `ResizeObserver` and returns `clamp(floor(height / unit), min, max)`; before the first measure, and when the height is 0 (as under jsdom), it returns `max`. No dependency is added.
   - My policies: the grid's rows come from `useFit(gridRef, 204, 1, 2)`; the page size is `rows * 2` (so 4 on a normal laptop, 2 on a short one). `PAGE_SIZE = 4` stays as the maximum. The pager follows the page size.
   - Policy page: rows per page come from `useFit(panelRef, 58, 2, 6)`; `FACT_PAGE = 6` stays as the maximum.
3. Names that can be long (policy title and insurer on a Home policy card, on a list card and in the renewal panel) are one line with an ellipsis: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, and the element carries `data-truncate` and `title` set to the full text. The policy page's `h1` wraps instead (up to its natural height) and is never truncated.
4. Policy page group panels have `overflow-y: auto`: a long value wraps in full inside its row, and if the rows then need more room than the panel has, the panel scrolls inside itself. The page itself still does not scroll.
5. Under `@media (max-height: 639px)` every screen root takes its natural height, so the page scrolls instead of cutting anything.
6. Under `@media (max-height: 720px)`: Home's sentence and big figure are 36px, the next-step line 22px, card padding 16px, gaps 12px; the policy page's name is 28px and its header card padding 16px; list card padding 16px. No font under 16px, no weight under 500.

### R5b.6 Out of scope

The statistic, e-card, people on a policy, logos, illustrations. My policies list. Wizard. `parts.tsx`. New dependencies.
