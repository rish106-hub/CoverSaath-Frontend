## R5c Wizard matches the approved canvas

Scope: the add-a-policy wizard (R3b) keeps every behaviour, screen and string it has, and gains the canvas look: a step bar with connecting lines, a wide two-column body with a drawn illustration, numbered fix cards on guidance screens, and a result screen that shows what was read. The judge is the browser harness (wizard and pay tests, zero findings) plus the unit suite. Earlier sections are in `docs/build/redesign-spec.md`.

Visual source (read before building; prototype code, copy nothing this section does not pin): `design/canvas-v6/shots/add-source.png`, `add-reading.png`, `add-guide.png`, `add-people.png`, `add-done.png`; `design/canvas-v6/extra.js` (`ART.doc`, `ART.fam`, `ART.pay`: the drawn illustrations) and `design/canvas-v6/flat.css`.

Persona served: a 25 to 35 year old tech worker adding a policy from a PDF on a laptop. The journey should feel made, not bare: a picture of what is happening, plain steps to fix a problem, and a result that shows the numbers that were read.

Not shown, because the product has no data or feature for it: Gmail and DigiLocker, "found so far" chips, the "while you wait" fact, people read from the policy, insurer logos, "we used the stricter one".

### R5c.1 Files

| File | Change |
|---|---|
| `src/components/covers/WizardArt.tsx` | New. `export function WizardArt({ kind }: { kind: "doc" \| "family" \| "pay" })`: one inline `<svg aria-hidden="true" focusable="false" viewBox="0 0 320 240">` per kind, shapes ported from `ART.doc`, `ART.fam`, `ART.pay`, with no `<animate>` element. Fills and strokes come from CSS classes in `wizard.module.css` that use theme tokens (`--mist` or `--fog` for ground shapes, `--harbour` for accent, `--orange` for the warm block, `--ink` for lines). |
| `src/components/covers/AddCoverView.tsx` | Layout only (R5c.2 to R5c.5). No state, effect, handler, string or test id changes except those pinned here. |
| `src/components/covers/wizard-copy.ts` | `guideFor` results gain `steps: { title: string; text: string }[]` (R5c.4). Nothing else changes. |
| `src/components/covers/PeopleStep.tsx` | Two-column layout with `<WizardArt kind="family" />` on the left. No logic change. |
| `src/components/covers/wizard.module.css` | New and changed layout rules. |
| `src/adapters/real-policy.ts` | Only if `toPolicyView` is not exported: add the `export` keyword to it. No other change. |
| `tests/components/kv-wizard.test.tsx` and other unit tests that fail only because of a pinned change | Updated; new titles in R5c.6. |

Not edited: `add-cover-flow.ts`, `pay-flow.ts`, `razorpay.ts`, `AppShell*`, other adapters, `src/components/ui/*`, `e2e/*`, Playwright configs, `package.json`.

### R5c.2 Frame

- Step bar: the four steps sit in one row joined by a line (`flex: 1`, 2px, `var(--line)`; the line before a done or current step is `var(--ok)`). A done step shows a filled `var(--ok)` circle with a tick; the current one a `var(--tide)` circle with its number; later ones an outlined circle. `aria-current="step"` and `data-done` stay.
- `Close` stays a link to `/home`, styled as the outline `md` button (46px tall), not `lg`.
- Middle row: `max-width: 1144px`, side padding 40px.
- Bottom row: a 1.5px top rule in `var(--line)`, `max-width: 1144px`, same side padding. Secondary action left, main action right (unchanged).

### R5c.3 Two-column screens

`consent`, `find`, `reading`, `pay` and `people` use `.split`: `display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 56px; align-items: center`. Left: `<WizardArt>` (`doc` for consent, find and reading; `pay` for pay; `family` for people), `max-height: 46vh`. Right: the screen's existing content, unchanged.

- `find`: the dashed drop area wraps the right column only.
- `reading`: above the `h1`, a line `{percent}%` (22px, weight 600) taken from `STAGE_COPY`; the `Bar` is 10px tall. The five stage rows stay under it.
- Under `@media (max-height: 720px)` the illustration's `max-height` is 34vh and the `h1` is 36px. Under `@media (max-width: 1180px)` `.split` gap is 32px.

### R5c.4 Guidance screen

- Above the `h1`: `<Signal kind="warn" variant="pill">One quick fix</Signal>`.
- When the guide has `steps`, they render as equal cards in one row (`Card`, up to three): a `var(--tide)` circle with the step number in `var(--lime)` (44px, weight 700), the step `title` (Newsreader, 26px, weight 500) and `text` (18px, weight 500). The `fix` paragraph is not shown when steps are shown. With no steps, the `fix` paragraph shows as today.
- `steps` values:
  - `PDF_PROTECTED`: `Open the PDF` / `Type the password. It is often your date of birth or policy number.`; `Print, then Save as PDF` / `This makes a new copy with no lock.`; `Add the new copy here` / `Knowvia reads it straight away.`
  - `PDF_ACTIVE_CONTENT`, `PDF_TOO_COMPLEX`: `Open the PDF` / `Any PDF viewer or your browser works.`; `Print, then Save as PDF` / `This makes a clean copy.`; `Add the new copy here` / `Knowvia reads it straight away.`
  - `FILE_TOO_LARGE`, `PDF_TOO_LONG`: `Open the PDF` / `Find the schedule: who is covered, the sum insured and the dates.`; `Print only those pages` / `Choose Save as PDF as the printer.`; `Add the smaller copy here` / `Knowvia reads it straight away.`
  - every other code: `steps` is `[]`.
- Titles, `fix` text, actions and buttons of R3b.5 do not change.

### R5c.5 Result screen (`cover`)

- Above the `h1`: `<Signal kind="ok">Added</Signal>`.
- `h1` unchanged (`{pick.label} is in.`).
- On reaching this screen, call `adapters.covers.holdingsView()` once, find the holding with `holdingId`, and take `toPolicyView(holding, null).headlines`. Each headline whose tone is `read` or `confirmed` renders as a `Card` (equal columns, up to three) with its label (18px, weight 500) and value (Source Sans, 26px, weight 700), inside `<ul data-testid="cover-facts">`. A failed call, no holding, or no such headline: no cards; nothing else changes.
- `Your cover is saved.` and the three links stay.

### R5c.6 Unit tests

New titles in `kv-wizard.test.tsx` (existing 22 stay and pass):

23. `the step bar draws a line between steps and ticks the done ones`
24. `find, reading, consent and pay show the document or payment illustration`
25. `reading shows the stage percent above the heading`
26. `a password-protected PDF shows three numbered fix cards`
27. `a too-large PDF shows the page-picking fix cards`
28. `a guide without steps still shows its fix line`
29. `the result screen shows the headline values that were read`
30. `the result screen shows no cards when the read fails`

### R5c.7 Done means

`KV_E2E_PORT=3313 npx playwright test -c playwright.real.config.ts e2e/real-screens.spec.ts -g "wizard|pay|payment"` passes with zero findings, the whole unit suite passes, and the screenshots `test-results/real/wizard-*.png` have been read beside the canvas shots.

### R5c.8 Out of scope

Any behaviour change. Gmail, DigiLocker, found-so-far chips, tips, people from the policy, logos. Home, list, policy page. `e2e/*`. New dependencies. Motion beyond what R3b.4 allows.
