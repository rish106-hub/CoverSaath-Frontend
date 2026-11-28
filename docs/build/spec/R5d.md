# R5d Compare, stress test and hospitals match the approved canvas

Scope: the three sub-tabs of My policies for a real account (`/compare`, `/stress-test`, `/hospitals`) are rebuilt to the canvas (Version 6) with only data the product really has. Data loading, `compareRows`, `estimate`, `sumInsuredRs`, `copayPct`, `useRealCovers`, `usePolicies`, `useHoldings` and the adapters are unchanged. The judge is the browser harness plus the unit suite.

Visual source (read before building; prototype code, copy no markup or copy this file does not pin): `design/canvas-v6/shots/compare.png`; `design/canvas-v6/screens-b.js` (`reg("compare"`, `reg("stress"`, `reg("hospitals"`); `design/canvas-v6/flat.css`.

Persona served: a 25 to 35 year old tech worker with one or two health policies. Compare shows both policies row by row and can hide what is the same. Stress test answers "what would I pay on this bill" with one big number. Hospitals answers "which hospitals near me take this policy without cash".

Not shown, because the product has no data for it: treatment names with typical costs, distance to a hospital, "claim on both policies", illustrations, insurer logos.

## R5d.1 Files

| File | Change |
|---|---|
| `src/components/cover-real/RealCompare.tsx` | `RealCompare` and `Ready` rewritten (R5d.2). `compareRows` and `Row` unchanged. |
| `src/components/cover-real/RealStress.tsx` | Rewritten (R5d.3). |
| `src/components/chat/HospitalsView.tsx` | Layout rewritten (R5d.4). State, `search` and the adapter call unchanged. |
| `src/components/cover-real/tools.module.css` | New. Styles for all three screens. |
| `e2e/real-tools.spec.ts` | New (R5d.6). |
| `e2e/real-account.ts` | New route: `GET /api/app/covers/holdings/{id}/hospitals` (R5d.6). Nothing else changes. |
| `tests/components/kv-tools.test.tsx` | New (R5d.7). |
| `tests/components/real-compare-stress-review.test.tsx`, `tests/components/chat-view.test.tsx`, `tests/components/chat-a11y.test.tsx`, other unit tests that fail only because of a change pinned here | Updated to the pinned markup. Every title is kept. No test file is deleted. |

Not edited: `real.module.css`, `covers.module.css`, `chat.module.css`, `parts.tsx`, `use-fit.ts`, `src/lib/*`, adapters, `src/components/ui/*`, `src/app`, shared type and global styles, landing files, `package.json`, `e2e/real-calm.ts`, `e2e/real-screens.spec.ts`.

## R5d.2 Compare (`RealCompare`)

Root `<div className={t.page}>`: flex column, `gap: 20px`, `flex: 1`, `min-height: 0`.

Loading, error and both empty branches render what they render today under `<PageTitle>Your policies side by side</PageTitle>`.

`ready`, with `readable` computed as today:

- `readable.length === 0`: `PageTitle` `Your policies side by side`, then the line `Your policies are still being read.` (18px, weight 500).
- `readable.length === 1`: `PageTitle` is `You have one policy. Add another to see them side by side.`; under it one primary link `Add a policy` to `/covers/add` (`.cta`). No table.
- `readable.length >= 2`:
  1. Head row (space between, aligned to the bottom): `PageTitle` `Your policies side by side`; right `<Switch label="Only what differs" checked={onlyDiff} onChange={...} />`. `onlyDiff` starts `false`. Changing it sets the page to 0.
  2. `shown = readable.slice(0, 3)`. With more than three readable policies the line `Showing your first three policies.` (18px, weight 500) follows the head row.
  3. `rows = compareRows(shown)`. A row is `same` when every cell has the same `value`. `visible = onlyDiff ? rows.filter(not same) : rows`.
  4. Table `<div role="table" aria-label="Policies side by side" data-testid="compare-table">`, no card and no outer border, columns `minmax(0, 26fr) repeat(n, minmax(0, 37fr))`:
     - Header row (`role="row"`): an empty `columnheader`, then per policy a `columnheader` with `p.title` (Newsreader, 28px, weight 500, one line with ellipsis, `data-truncate`, `title={p.title}`) and, when set, `p.insurer` (18px, weight 500, same one-line rule).
     - Body `<div ref={bodyRef} className={t.body}>` (`flex: 1`, `min-height: 0`, `overflow: hidden`). Rows per page `perPage = useFit(bodyRef, 50, 3, 10)`. It shows `visible.slice(page * perPage, page * perPage + perPage)`.
     - Each row `<div role="row" data-same={same}>`: 1.5px top rule in `var(--line)`, min-height 50px, cells vertically centred. `rowheader` `row.label` (18px, weight 500). Each `cell` (18px; weight 600 when the row differs, 500 when same; `data-open={c.open}`): when `c.open` the value is wrapped as `<Signal kind="warn">{c.value}</Signal>`, otherwise plain text. Values wrap (`overflow-wrap: anywhere`).
     - `visible.length === 0`: instead of rows, the line `These policies match on everything Knowvia read.`
  5. Foot row (space between): left a text link `Run a hospital bill through them` to `/stress-test` (18px, weight 600, `var(--harbour)`, underlined); right, only when `visible.length > perPage`, the pager: outline buttons `Back` and `Next` (disabled at the ends) and `Page {page + 1} of {pages}` in a `role="status"` element. If the page index is past the last page after a resize it is clamped.

Removed from this screen: `SectionHeading`, `k-btn` classes, the `Add a policy` and `Stress test a policy` buttons under the table, `real.module.css`, `covers.module.css`.

## R5d.3 Stress test (`RealStress`)

Root `.page` as R5d.2. `PageTitle` `Who pays if a hospital bill comes?`. Loading, error and empty branches as today.

`Test`: grid `.two`, `grid-template-columns: minmax(0, 5fr) minmax(0, 6fr)`, `gap: 48px`, `flex: 1`, `min-height: 0`, both columns aligned to the top.

Left column (flex column, `gap: 28px`):

1. Policy. Labels: `c.holding.summary?.productName || "Health policy"` per cover; when two labels are equal each gets ` {index + 1}` appended. One cover: the label as text (18px, weight 600). Two or three covers: `<Segmented label="Policy" options={labels} value={label of cur} onChange={...} />`. More than three: `<Field label="Policy"><select>…</select></Field>` with the labels as options.
2. `<Field label="Hospital bill, in rupees">` with `<input inputMode="numeric" className={t.bigin} placeholder="3,00,000">` (Source Sans, 30px, weight 600, height 64px). The stored state is digits only (non-digits stripped, at most 9); the shown value is the digits formatted with `inr()` (empty when there are none). `billRs` is the number, or `null` when there are no digits.
3. Three quick-fill outline buttons in one row, `Rs 1,00,000`, `Rs 5,00,000`, `Rs 15,00,000`; each sets the bill to that amount.

Right column `<div role="status" aria-live="polite" data-testid="stress-result">` (flex column, `gap: 20px`); it is the only `role="status"` element on the screen:

- `si === null`: the sentence `The sum insured of this policy has not been read or needs your decision yet, so we cannot work out who pays.` (22px, weight 500) and the link `Check what we found` to `/covers/review?holding={id}` (primary, `.cta`). Nothing else.
- Otherwise, with `est = billRs !== null ? estimate(billRs, si, copay) : null`:
  1. `You pay` (18px, weight 600).
  2. `<p className={t.you} data-testid="you-pay" data-over={est?.limited === true}>Rs {inr(est ? est.youPay : 0)}</p>`: Source Sans, 64px, weight 600, tabular numerals; colour `var(--bad)` when `est.limited`, otherwise `var(--ink)`.
  3. Reason (18px, weight 500): no bill: `Type a bill to see who pays. Sum insured read from your policy: Rs {inr(si)}.`; limited: `The bill goes past your sum insured of Rs {inr(si)}.`; otherwise `Within your sum insured of Rs {inr(si)}.`
  4. Split bar `<div className={t.split} aria-hidden="true"><i style={{ width: pct + "%" }} /></div>`: height 14px, radius 7px, track `var(--bad)` when `est.youPay > 0` else `var(--fog)`, fill `var(--ok)`; `pct = est && est.bill > 0 ? (est.insurerPays / est.bill) * 100 : 0`.
  5. Lines `<div role="list">`: one `<div role="listitem">` per `est.lines` (label left, `Rs {inr(l.value)}` right, 18px; 1.5px bottom rule; min-height 46px; the `pay` line has weight 600, the others 500 for the label and 600 for the amount). With no bill the same lines show from `estimate(0, si, copay)`.
  6. One line (18px, weight 500, `var(--graphite)`): `Counts your sum insured{copay ? " and co-pay" : ""}. Room rent and other limits are not counted.`

Removed: `SectionHeading`, the dark `.pays` box, the old estimate paragraph, `real.module.css`, `covers.module.css`.

## R5d.4 Hospitals (`HospitalsView`)

Root `.page`. `PageTitle` `Network hospitals`.

1. No policy (`holdings.length === 0 && !listError`): `<EmptyState title="No policy yet" body="Add your policy and we can show the hospitals in its network." cta="Add a policy" href="/covers/add" />` and nothing else under the title.
2. Otherwise the form `<form className={t.find}>` inside one `Card` (padding 24px), one row aligned to the bottom, `gap: 20px`:
   - `<Field label="Pincode">` with the input as today (same attributes), width 240px.
   - Only when `holdings.length > 1`: `<Field label="Cover"><select>…<CoverOptions holdings={holdings} /></select></Field>` with today's `onChange`, taking the remaining width (`flex: 1`, `min-width: 0`).
   - `<Button type="submit" state={busy ? "busy" : "idle"} busyLabel="Searching" disabled={!valid || busy}>Find hospitals</Button>`.
3. `listError || error`: `<p role="alert">` with `errorText(...)` as today (18px, weight 600, `var(--bad)`).
4. Before any search and with no error: `<p className={t.lead}>Type a pincode to see which hospitals take your policy without cash.</p>` (Newsreader, 28px, weight 500, max 24ch).
5. `found` with an empty list: `No network hospital is listed for this pincode. Try a nearby one.` (18px, weight 500).
6. `found` with hospitals:
   - Count line `<p data-testid="hospital-count">`: `{n} hospitals near {pincode} · {cashless count} cashless` (`1 hospital` for one), 18px, weight 600.
   - `<ul ref={listRef} aria-label="Hospitals" className={t.hlist}>` (`flex: 1`, `min-height: 0`, `overflow: hidden`). Rows per page `useFit(listRef, 62, 2, 8)`; pager as R5d.2 item 5 (right aligned) when there are more hospitals than fit. A new search sets the page to 0.
   - Each `<li>` is one row in three columns (`minmax(0, 3fr) minmax(0, 4fr) max-content`), min-height 62px, 1.5px bottom rule: `<b>{h.name}</b>` (18px, weight 600); the address `[h.address, h.city, h.pincode]` joined with `, ` skipping empty parts (18px, weight 500); `<span data-cashless={h.cashless}>` holding `<Signal kind="ok">Cashless</Signal>` or `<Signal kind="warn">Cashless not listed</Signal>`. Name and address are one line with ellipsis, `data-truncate`, `title` with the full text.

Removed: `SectionHeading`, the description `Six digits, as on a postal address.`, the bottom `Ask about your cover` link, `k-btn` classes, `chat.module.css` in this file.

## R5d.5 Styles and fit

`tools.module.css`: theme tokens only; no hex colours, shadows, gradients, blur or `@keyframes`; sizes in px, none under 16px; no weight under 500. `.cta` and `.outline` match the `Button` primary and outline `md` boxes. Inputs and selects: height 52px (the bill input 64px), 1.5px border `var(--field-border)`, radius `var(--r-btn)`, 18px, weight 500.

Fit rules of `docs/build/spec/R5b.md` section R5b.7 apply: nothing is cut by a fixed-height box; under `@media (max-height: 720px)` gaps are 12px, the bill input is 52px high and `.you` is 44px; under `@media (max-height: 639px)` `.page`, `.two`, the table body and the hospital list take natural height (`flex: none`, `overflow: visible`) so the page scrolls.

## R5d.6 Harness

`e2e/real-account.ts`: `GET` on a path matching `^/api/app/covers/holdings/[^/]+/hospitals$` answers `{ ok: true, data: { hospitals } }` in the same envelope the file's `data()` helper builds: pincode `560099` gives an empty list; any other pincode gives 12 synthetic hospitals (`Example Hospital 1` to `12`, synthetic addresses in `Bengaluru`, the searched pincode, every third one `cashless: false`), and with `opts.long` the first name and address are 90 characters long.

`e2e/real-tools.spec.ts` (imports from `./real-account` and `./real-calm`; server mode and sign-in as `e2e/real-screens.spec.ts`). Titles:

1. `compare shows both policies and hides equal rows with Only what differs`
2. `compare is calm at every laptop size`
3. `compare with one policy asks for another`
4. `stress test shows what you pay for a typed bill and turns red past the sum insured`
5. `stress test is calm at every laptop size`
6. `hospitals lists results for a pincode with a pager`
7. `hospitals is calm before and after a search at every laptop size`
8. `long names and a short viewport cut nothing off on compare, stress test and hospitals`

Tests 2, 5 and 7 use `expectCalm` at every entry of `SIZES` and take a screenshot with `shot()` (`compare`, `stress`, `hospitals`); test 8 uses `opts.long` at 1440x900 with `expectCalm` and the default account at 1280x560 with `expectNothingCutOff`. All 8 pass with zero findings, and every test in `e2e/real-screens.spec.ts` still passes.

## R5d.7 Unit tests: `tests/components/kv-tools.test.tsx`

Titles:

1. `compare with two policies shows a column per policy and a row per fact`
2. `Only what differs hides rows whose values are equal`
3. `when nothing differs compare says the policies match`
4. `an open value in compare carries the yellow signal`
5. `compare with one readable policy asks for another and shows no table`
6. `compare shows at most three policies and says so`
7. `stress test formats the typed bill and shows what you pay`
8. `past the sum insured the amount is marked over and the reason says so`
9. `a quick-fill button sets the bill`
10. `two policies get a segmented picker and three get one too`
11. `without a readable sum insured stress test links to what we found`
12. `hospitals shows the lead line before a search`
13. `hospital rows show name, address and the cashless signal`
14. `no hospital for a pincode shows the try nearby line`
15. `hospitals with no policy shows the empty state`

## R5d.8 Out of scope

`CoverReviewView` and `/covers/review`. The mock `Compare`, `StressTest` views. `ia.ts`. Stress test across two policies. New dependencies.
