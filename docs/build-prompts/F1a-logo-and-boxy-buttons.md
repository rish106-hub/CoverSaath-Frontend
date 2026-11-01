# F1a: sidebar brand logo + one boxy button style (Sonnet medium build brief)

Launch as: Agent tool, `model: "sonnet"`, `effort: "medium"`, worktree `Knowvia Frontend.worktrees/f1a-polish` (branch `feat/polish-ui`; already created from main; `git merge --ff-only main` first, then `rm -rf node_modules && npm ci`).

Rules: work only in that worktree; no push (no remote); no `.env` access; commit per passing slice, ending each commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not create profile files and do not edit `src/lib/ia.ts`, `src/adapters/*`, `src/components/shell/UserChip.tsx` (agent F1b owns them).

Owner feedback (verbatim, 2026-11-01): "Knowvia in the left pane has to have the KNowvia logo and not a text thing . Every button must look like a boxy button!" The visual design is otherwise approved; change only what is asked.

## Task 1: brand logo
`src/components/shell/AppSidebar.tsx` (class `brand`) shows plain text "Knowvia". The landing site shows the K mark plus the wordmark: read `/Users/rishavdewan/Developer/Product experiments/Knowvia_website/src/components/layout/SiteNav.tsx` lines ~14-30 for size, gap and wordmark font. Copy `/Users/rishavdewan/Developer/Product experiments/Knowvia_website/public/brand/knowvia-mark.svg` to `public/brand/knowvia-mark.svg`. Create `src/components/brand/BrandMark.tsx` (mark at 28-32px, `alt=""`, plus wordmark in the landing nav font and a token colour, wrapped in the Link with `aria-label="Knowvia home"`). Use it in the sidebar, the mobile top bar and drawer, the PageHeader breadcrumb root if it shows "Knowvia", and the sign-in and beta pages wherever a text "Knowvia" acts as a logo. Keep `src/app/icon.svg` and `apple-icon.png`. Test: sidebar brand contains an `<img>` of the mark; link has the aria-label.

## Task 2: boxy buttons everywhere
Audit every clickable control (button, link styled as button, role="button", chips, pill tabs, segmented controls, filter pills). Find them with `grep -rnE "border-radius" src --include="*.css"` and by reading button-like classes (`.btn .cta .pill .chip .sw .big .rbtn .gapCta .cellAct .person .mini .tab`). Today many use 999px / 50% / 14-20px. Required:
- Tokens in `src/styles/tokens.css`: `--r-btn: 8px`, `--r-btn-sm: 6px`, `--btn-h: 44px`, `--btn-h-sm: 36px`.
- Primary: solid fill, 1px border of the same colour, radius `var(--r-btn)`, min-height 44px (36px small), padding 0 18px, font 500 14px, visible hover, `:focus-visible` outline 2px offset 2px, disabled (opacity .5, not-allowed), pressed (translateY(1px)).
- Secondary: `--sheet`/transparent fill, 1px solid readable line colour, same radius and heights.
- Selected chips and segmented options: same radius, filled when on.
- One shared sheet `src/styles/buttons.css` imported from `globals.css` defining `.k-btn`, `.k-btn--primary`, `.k-btn--secondary`, `.k-btn--sm`, `.k-btn--danger` (Emergency). Migrate every module's existing button classes to the same token values (via `composes:` or the same tokens). Do not rename classes that tests select by.
- Stay round: avatars, status dots, switch tracks and knobs (`role="switch"` stays a switch), progress bars. A pure icon-only mic orb may stay round only if listed in the report with the reason; a button with a visible label becomes a 12px rounded square.
- Text links inside paragraphs stay underlined links.
- Dark mode: button text contrast at least 4.5:1; extend the existing contrast test for the new tokens in both themes.
- No printed shortcut hint text on buttons, no pill/circle eyebrow labels, tokens only (no raw colours).
- Guard test `tests/buttons.test.ts`: reads every `*.css` under `src` and fails if a selector named like `/(btn|button|cta|chip|pill|tab|big)/i` has `border-radius` 999px, 50% or 16px and above (allow-list switch/knob/dot/avatar/orb selectors by name, with comments).

## Checks before reporting (all in the worktree)
`npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Quote real output tails. A timing flake in a loaded full run: rerun that file alone and say so. Never weaken a test.

## Report (under 25 lines)
Files changed (grouped), number of button classes migrated, selectors left round and why, check results with numbers, what is NOT verified (no browser: do not claim visual verification).
