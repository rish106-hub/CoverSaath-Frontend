# R3b evals — Add-a-policy wizard (`/covers/add`, one screen per step)

> Base for every diff check is the literal token `$(git log -1 --format=%H -- docs/build/evals/R3b.md)` (substituted before running). Run all commands from the worktree root (`.claude/worktrees/flat-redesign`) under bash or zsh. Source of truth: `docs/build/redesign-spec.md` section "R3b Add-a-policy wizard". Written from the spec, not from the builder's code. No database, no paid API, no network: unit tests use mock adapters. Do not print `.env*`. Playwright is not run in this task.

Vitest named checks: PASS needs exit 0 and output matching `1 passed` (a zero-match run or a skipped test is FAIL). Titles are matched with `-t` as regex; none of the titles hold regex metacharacters that change the match. Shorthand used below: `C=src/components/covers`, `W=$C/wizard-copy.ts`, `V=$C/AddCoverView.tsx`, `P=$C/PeopleStep.tsx`, `S=$C/wizard.module.css`, `T=tests/components/kv-wizard.test.tsx`.

## A. Scope

R3b-01. Changed paths are a subset of the R3b.1 table and the four new files exist — cmd: `{ git diff --name-only $(git log -1 --format=%H -- docs/build/evals/R3b.md); git ls-files --others --exclude-standard; } | sort -u | grep . | grep -vxE 'src/components/shell/AppShell\.tsx|src/components/shell/AppShell\.module\.css|src/components/covers/AddCoverView\.tsx|src/components/covers/wizard-copy\.ts|src/components/covers/PeopleStep\.tsx|src/components/covers/wizard\.module\.css|tests/components/kv-wizard\.test\.tsx|tests/components/add-cover-view\.test\.tsx|tests/components/add-cover-resume\.test\.tsx|tests/components/consent-upload-states\.test\.tsx|e2e/add-cover\.ts|e2e/journey\.spec\.ts'; echo "stray-done"; for f in src/components/covers/wizard-copy.ts src/components/covers/PeopleStep.tsx src/components/covers/wizard.module.css tests/components/kv-wizard.test.tsx; do test -s $f || echo "MISSING $f"; done` — expect: output is exactly `stray-done` (no stray path before it, no MISSING line) — PASS if no path outside the 12 table rows changed or is untracked and all four new files exist and are non-empty.

R3b-02. Not-edited files unchanged — cmd: `git diff --stat $(git log -1 --format=%H -- docs/build/evals/R3b.md) -- src/components/covers/add-cover-flow.ts src/components/covers/pay-flow.ts src/lib/razorpay.ts src/adapters src/components/covers/covers.module.css src/components/covers/CoverReviewView.tsx src/components/covers/DeclarationsView.tsx src/lib/ia.ts src/app src/styles/tokens.css src/components/landing package.json package-lock.json | wc -l | tr -d ' '` — expect: output `0` — PASS if none of those paths differ from `$(git log -1 --format=%H -- docs/build/evals/R3b.md)` (no new dependency, no adapter or backend change, no landing change). Also run `git status --porcelain -- src/adapters src/app src/components/landing package.json package-lock.json` and expect empty output.

## B. Bare shell (R3b.2)

R3b-03. Bare mode wired in AppShell and CSS — cmd: `f=src/components/shell/AppShell.tsx; c=src/components/shell/AppShell.module.css; grep -qE 'const bare = pathname === "/covers/add";' $f && grep -q 'data-shell="bare"' $f && grep -q 'styles.bare' $f && grep -qE '\.bare\s*\{[^}]*height:\s*100dvh' $c && grep -qE '\.bare\s*\{[^}]*overflow:\s*hidden' $c && awk '/@media \(max-width: 1023px\)/{m=1} m&&/\.bare[^{]*\{/{f=1} m&&f&&/display:\s*none/{ok=1} END{exit !ok}' $c` — expect: exit 0 — PASS if the `bare` constant, `data-shell="bare"`, `.bare` with `height: 100dvh` and `overflow: hidden`, and a `.bare` rule with `display: none` inside the existing `@media (max-width: 1023px)` block are all present.

## C. wizard-copy.ts surface and pinned copy (R3b.3, R3b.5)

R3b-04. Exports, constants, no JSX — cmd: `W=src/components/covers/wizard-copy.ts; for p in 'export const WIZARD_STEPS = \["Find your policy", "Reading it", "Your people", "Your cover"\] as const' 'export type WizardScreen' 'export type ScreenInput' 'export function screenOf\(' 'export function stepOf\(' 'export const STAGE_COPY' 'export function guideFor\(' 'export const POLL_MS = 5000' 'export const POLL_MAX = 36'; do grep -qE "$p" $W || { echo "MISSING $p"; exit 1; }; done; ! grep -nE '<[A-Za-z][A-Za-z0-9]*[ />]|React' $W` — expect: exit 0 — PASS if every export and both constant values match and the file holds no JSX or React import.

R3b-05. STAGE_COPY rows verbatim with percents — cmd: `W=src/components/covers/wizard-copy.ts; for s in 'Sending your PDF' 'Safety check' 'Checking the file is safe.' 'Reading the pages' 'Reading the pages.' 'Pulling out cover details' 'Pulling out your cover details.' 'Finding your plan' 'Finding your plan.'; do grep -qF "$s" $W || { echo "MISSING $s"; exit 1; }; done; for n in 15 35 55 75 90; do grep -qE "\b$n\b" $W || { echo "MISSING percent $n"; exit 1; }; done; for k in sending checking reading details matching; do grep -qE "\b$k\b" $W || { echo "MISSING stage $k"; exit 1; }; done` — expect: exit 0 — PASS if all nine strings, the five percents and the five stage keys appear in `wizard-copy.ts`.

R3b-06. guideFor titles and fixes verbatim — cmd: `W=src/components/covers/wizard-copy.ts; for s in 'This PDF has a password on it.' 'Open it, choose Print, then Save as PDF. Add the new copy.' 'This PDF needs a clean copy.' 'That file is not a PDF.' "Download the policy as a PDF from your insurer's email or app." 'That PDF is too big.' 'Add only the schedule pages: who is covered, the sum insured and the dates.' 'That PDF has too many pages.' 'We could not open this PDF.' 'Download a fresh copy from your insurer and add it.' 'We could not accept this file.' 'Add another copy of the policy.' 'We could not read this one.' "Add it again, or use the copy from your insurer's email." 'This policy is already added.' 'Open it from My policies.' 'Reading is paused right now.' 'Your file is saved. Come back in a little while.' 'Please sign in again.' 'Then add your policy.' 'That did not go through.' 'Check your connection and try again.'; do grep -qF "$s" $W || { echo "MISSING $s"; exit 1; }; done; for c in PDF_PROTECTED PDF_ACTIVE_CONTENT PDF_TOO_COMPLEX FILE_TYPE_INVALID FILE_TOO_LARGE PDF_TOO_LONG FILE_EMPTY PDF_UNREADABLE DOCUMENT_REJECTED POLICY_TYPE_INVALID HOLDING_CREATE_FAILED READING_FAILED DUPLICATE_DOCUMENT HOLDING_DOCUMENT_HAS_HOLDING READING_UNAVAILABLE UPLOAD_UNAVAILABLE HOLDINGS_DISABLED UNAUTHENTICATED; do grep -qF "$c" $W || { echo "MISSING code $c"; exit 1; }; done` — expect: exit 0 — PASS if all 22 strings and all 18 mapped codes appear in `wizard-copy.ts`.

R3b-07. screenOf order and stepOf mapping — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "screenOf follows the pinned order for every screen|stepOf maps every screen to its step"` — expect: exit 0 and output matching `2 passed` — PASS if both named tests pass (11-rule first-match order and the step mapping 1/2/3/4 from R3b.3 are proven by them).

R3b-08. guideFor behaviour — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "guideFor returns the pinned title, fix and action for every listed code|guideFor falls back to the retry guidance for an unknown code"` — expect: exit 0 and output matching `2 passed` — PASS if both pass.

## D. Frame and styles (R3b.4)

R3b-09. Frame markup — cmd: `V=src/components/covers/AddCoverView.tsx; grep -qE 'data-screen=\{' $V && grep -qE 'className=\{s\.frame\}|className=\{styles\.frame\}' $V && grep -qF 'aria-label="Steps"' $V && grep -qF 'aria-current' $V && grep -qE 'data-done' $V && grep -qE 'href="/home"' $V && grep -q 'Close' $V && grep -q 'BrandMark' $V && grep -q 'Knowvia' $V && grep -q 'WIZARD_STEPS' $V && grep -qE '72px minmax\(0, 1fr\) 88px' src/components/covers/wizard.module.css && grep -qE 'height:\s*100dvh' src/components/covers/wizard.module.css && grep -qE '760px' src/components/covers/wizard.module.css && grep -q 'var(--paper)' src/components/covers/wizard.module.css` — expect: exit 0 — PASS if the frame has `data-screen`, `aria-label="Steps"`, `aria-current`, `data-done`, the Close link to `/home`, `BrandMark`, the word Knowvia, `WIZARD_STEPS`, and the CSS has the `72px minmax(0, 1fr) 88px` rows, `100dvh`, `760px` column and `var(--paper)`.

R3b-10. Frame behaviour — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "the frame shows four steps and marks the current one"` — expect: exit 0 and `1 passed` — PASS if the test passes.

R3b-11. wizard.module.css rules — cmd: `S=src/components/covers/wizard.module.css; ! grep -nE '#[0-9a-fA-F]{3,8}\b' $S && ! grep -n 'box-shadow' $S && ! grep -ni 'gradient' $S && ! grep -nE 'backdrop-filter|blur\(' $S && ! grep -nE 'font-size:\s*([0-9]|1[0-5])(\.[0-9]+)?px' $S && ! grep -nE 'font-weight:\s*([1-4][0-9]{2}|[0-9]{1,2})\b' $S && test "$(grep -c '@keyframes' $S)" = 1 && grep -qE '@keyframes kvWizardPulse' $S && grep -q '@media (prefers-reduced-motion: reduce)' $S && grep -q 'linkPrimary' $S && grep -q 'linkOutline' $S` — expect: exit 0, no output — PASS if there is no hex colour, no `box-shadow`, no gradient, no `backdrop-filter` or `blur(`, no `font-size` under 16px, no `font-weight` under 500, exactly one `@keyframes` named `kvWizardPulse`, a `prefers-reduced-motion: reduce` block, and `.linkPrimary` and `.linkOutline` exist. (A `font-size` in `rem` or `var()` is not checked here; reviewer reads the file if any appear.)

## E. Pinned copy in source (R3b.5)

R3b-12. Consent, pay, find copy and legal-review comments — cmd: `V=src/components/covers/AddCoverView.tsx; for s in '// FOR LEGAL REVIEW: the wording below is not final.' '// FOR LEGAL REVIEW: price and payment wording.' 'Can Knowvia read your policy?' 'Keep it in your account, in encrypted storage.' 'Check it for harmful content.' 'Read its text and pull out the cover details, such as sum insured and waiting periods.' 'Yes, read my policy' 'Saving' '/privacy' 'Add another policy for Rs ' 'Your first policy is free. Each one after that is Rs ' ', paid once.' 'Pay Rs ' 'Check again' 'Sign in' '/signin' 'Paid. You can add your policy now.' 'Drop your policy PDF here.' 'PDF, up to ' 'The schedule page is enough: who is covered, the sum insured and the dates.' 'Type of policy' 'Choose PDF' 'Policy schedule PDF' 'application/pdf,.pdf'; do grep -qF -- "$s" $V || { echo "MISSING $s"; exit 1; }; done; grep -q 'data-testid="policy-type"' $V && grep -q 'data-testid="schedule-input"' $V && grep -q 'data-testid="pay-card"' $V && grep -q 'data-slot="policy_schedule"' $V` — expect: exit 0 — PASS if all strings appear in `AddCoverView.tsx` (the pay copy may come from `payCopy`, but the pinned literals here must be in the view), both legal-review comments are present exactly, and the kept test ids `policy-type`, `schedule-input`, `pay-card` and `data-slot="policy_schedule"` are present.

R3b-13. Reading, guide, plan copy — cmd: `V=src/components/covers/AddCoverView.tsx; for s in 'Reading your policy' '(in progress)' 'Still working on it. A long policy can take a minute or two.' 'Choose another PDF' 'Try again' 'Open my policies' 'Go to Home' 'Which plan is this?' 'We think this is ' 'Tell us which plan this is.' 'We could not tell from the first pages. Search for it below.' 'Something else' 'Back to our guesses' 'Plan choices' 'Insurer or plan name' 'Search results' 'Nothing matched. Try fewer words.' 'Search' 'Yes, it is ' 'Choose a plan' "Checking your insurer's terms" 'Your cover is saved.' 'Open my policy' 'See what we found' 'Add health details' '/covers/review?holding=' '/covers/declarations?holding=' '/policies/' 'role="radiogroup"' 'aria-expanded' 'role="alert"' 'data-state="working"' 'data-state="failed"' 'is in.'; do grep -qF -- "$s" $V || { echo "MISSING $s"; exit 1; }; done; grep -qF 'slice(0, 3)' $V && grep -qF 'slice(0, 4)' $V && grep -qE 'maxLength=\{?"?100' $V` — expect: exit 0 — PASS if every pinned string, both caps `slice(0, 3)` (guesses) and `slice(0, 4)` (search results), and `maxLength` 100 are in `AddCoverView.tsx`.

R3b-14. People step copy — cmd: `P=src/components/covers/PeopleStep.tsx; for s in 'Who is in your family?' 'We could not load your family. Add people later from Family.' 'Name' 'Relation' 'Spouse' 'Son' 'Daughter' 'Father' 'Mother' 'Other' 'Add person' 'Adding' 'We could not save that. Try again.' 'Skip for now' 'Continue' ' more' 'members.list' 'members.add' 'isOwner' 'isYou' 'onDone'; do grep -qF -- "$s" $P || { echo "MISSING $s"; exit 1; }; done; grep -qE 'slice\(0, 4\)' $P && grep -qE 'maxLength=\{?"?80' $P` — expect: exit 0 — PASS if all strings, the 4-row cap and `maxLength` 80 are in `PeopleStep.tsx`, with `isOwner` and `isYou` used to hide the signed-in person.

R3b-15. Polling constants used by the view — cmd: `V=src/components/covers/AddCoverView.tsx; grep -q 'POLL_MS' $V && grep -q 'POLL_MAX' $V && grep -q 'setTimeout' $V && grep -q 'clearTimeout' $V && grep -q 'screenOf' $V && grep -q 'guideFor' $V && grep -q 'STAGE_COPY' $V && grep -q 'PeopleStep' $V && grep -q 'runPay' $V && grep -q 'confirmPay' $V && grep -q 'payCopy' $V && grep -q 'realPayDeps' $V` — expect: exit 0 — PASS if the view imports and uses the pinned helpers and clears its timer.

## F. Removed things and privacy (R3b.7, R3b.6)

R3b-16. Removed things absent from the view — cmd: `V=src/components/covers/AddCoverView.tsx; ! grep -nE 'PageTitle|SectionHeading|covers\.module\.css|k-btn|type="checkbox"|payWithRazorpay|Opening payment|: added\.' $V` — expect: exit 0, no output — PASS if none of the eight removed tokens appear in `AddCoverView.tsx`.

R3b-17. No UIN or registry number rendered — cmd: `grep -niE 'uin|registry' src/components/covers/AddCoverView.tsx src/components/covers/PeopleStep.tsx src/components/covers/wizard-copy.ts | grep -vE '^[^:]+:[0-9]+:\s*(//|\*|/\*)'` — expect: exit 1, no output — PASS if the only matches are comment lines (lines starting with `//`, `*` or `/*`); any match in code or JSX text is FAIL. Behaviour is also covered by R3b-27.

## G. New unit tests (R3b.9)

R3b-18. All 22 pinned titles exist verbatim — cmd: `T=tests/components/kv-wizard.test.tsx; while IFS= read -r t; do grep -qF -- "\"$t\"" $T || { echo "MISSING $t"; exit 1; }; done <<'EOF'
screenOf follows the pinned order for every screen
stepOf maps every screen to its step
guideFor returns the pinned title, fix and action for every listed code
guideFor falls back to the retry guidance for an unknown code
the frame shows four steps and marks the current one
consent has one button and no checkbox, and granting moves to find
a held file is sent again after consent is granted
reading shows the stage heading, the five rows and a bar at the stage percent
a waiting document is checked again by itself and the timer stops on unmount
a password-protected PDF shows guidance with Choose another PDF and no code
a network failure shows Try again and Choose another PDF
guesses are capped at three and search results at four
pay shows the price in the heading and the button
a stopped payment shows its reason and Pay again
an unconfirmed payment offers Check again and no Pay button
after paying, the held file goes up without choosing it again
people lists the family, adds a person and keeps the name on failure
Skip for now and Continue both reach the cover screen
cover names the plan and links to the policy, the findings and health details
AppShell in bare mode has no rail, top bar or ask bar on /covers/add
AppShell keeps the rail on every other path
no screen renders an error code
EOF
n=$(grep -cE '^\s*(it|test)\(' $T); test "$n" -eq 22 && ! grep -nE '\.(skip|todo|only)\b|\b(xit|xtest)\(' $T` — expect: exit 0 — PASS if every title is found in quotes in the file, the file holds exactly 22 `it`/`test` calls, and none is skipped, todo or `.only`.

R3b-19. All 22 new tests pass, none skipped — cmd: `out=$(npx vitest run tests/components/kv-wizard.test.tsx 2>&1); rc=$?; echo "$out" | tail -8; test $rc -eq 0 && echo "$out" | grep -qE 'Tests\s+22 passed \(22\)' && ! echo "$out" | grep -qiE 'skipped|todo|failed'` — expect: exit 0 — PASS if the run exits 0 with `Tests 22 passed (22)` and no skipped, todo or failed line.

## H. Existing tests kept (R3b.10)

R3b-20. The 12 existing titles still exist verbatim — cmd: `while IFS='|' read -r f t; do grep -qF -- "\"$t\"" "tests/components/$f" || { echo "MISSING $f: $t"; exit 1; }; done <<'EOF'
add-cover-view.test.tsx|takes the cover type, then one schedule, and has no terms slot
add-cover-view.test.tsx|says it is reading the schedule while it works
add-cover-view.test.tsx|a failed holding shows a clear failed state with no retry of the same file
add-cover-view.test.tsx|checks the insurer's terms on confirm, then offers the policy page for the holding
add-cover-resume.test.tsx|lists the document still being read ahead of the payment card, and follows it again
add-cover-resume.test.tsx|shows the payment card when nothing is in progress
add-cover-resume.test.tsx|does not take over the page for a document that already has its holding
add-cover-resume.test.tsx|does not resume a quarantined or deleting document
consent-upload-states.test.tsx|shows a loading state while consent is being read
consent-upload-states.test.tsx|a failed read shows a plain-English error with Retry, not the consent form, and Retry recovers
consent-upload-states.test.tsx|an expired session on load offers sign in, not a retry loop
consent-upload-states.test.tsx|plan lookup failure after upload offers Try again
EOF
cd tests/components && ! grep -nE '\.(skip|todo)\b|\b(xit|xtest)\(' add-cover-view.test.tsx add-cover-resume.test.tsx consent-upload-states.test.tsx` — expect: exit 0 — PASS if all 12 titles are present verbatim in the named files and none is skipped or todo.

R3b-21. The 12 existing tests pass — cmd: `out=$(npx vitest run tests/components/add-cover-view.test.tsx tests/components/add-cover-resume.test.tsx tests/components/consent-upload-states.test.tsx 2>&1); rc=$?; echo "$out" | tail -8; test $rc -eq 0 && echo "$out" | grep -qE 'Tests\s+12 passed \(12\)' && ! echo "$out" | grep -qiE 'skipped|failed'` — expect: exit 0 — PASS if exit 0 with `Tests 12 passed (12)` and no skipped or failed line.

## I. Behaviour and failure paths (named titles)

R3b-22. Consent screen has one button, no checkbox — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "consent has one button and no checkbox, and granting moves to find"` — expect: exit 0 and `1 passed` — PASS if the test passes. Companion: `npx vitest run tests/components/kv-wizard.test.tsx -t "a held file is sent again after consent is granted"` expect `1 passed`.

R3b-23. Reading screen and automatic re-check, timer stops on unmount — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "reading shows the stage heading, the five rows and a bar at the stage percent|a waiting document is checked again by itself and the timer stops on unmount"` — expect: exit 0 and `2 passed` — PASS if both pass (stage heading, five rows, bar at stage percent; 5000 ms re-check; no check after unmount).

R3b-24. Protected PDF guidance, no code shown (failure path) — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "a password-protected PDF shows guidance with Choose another PDF and no code"` — expect: exit 0 and `1 passed` — PASS if the test passes. Companion network-failure path: `-t "a network failure shows Try again and Choose another PDF"` expect `1 passed`.

R3b-25. Plan caps — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "guesses are capped at three and search results at four"` — expect: exit 0 and `1 passed` — PASS if the test passes.

R3b-26. Payment paths (failure and recovery) — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "pay shows the price in the heading and the button|a stopped payment shows its reason and Pay again|an unconfirmed payment offers Check again and no Pay button|after paying, the held file goes up without choosing it again"` — expect: exit 0 and `4 passed` — PASS if all four pass (an unconfirmed payment offers Check again and no Pay button, so the user cannot pay twice).

R3b-27. People, cover, shell and no error codes — cmd: `npx vitest run tests/components/kv-wizard.test.tsx -t "people lists the family, adds a person and keeps the name on failure|Skip for now and Continue both reach the cover screen|cover names the plan and links to the policy, the findings and health details|AppShell in bare mode has no rail, top bar or ask bar on /covers/add|AppShell keeps the rail on every other path|no screen renders an error code"` — expect: exit 0 and `6 passed` — PASS if all six pass.

## J. Security and gates

R3b-28. No secret or payment key added — cmd: `git diff $(git log -1 --format=%H -- docs/build/evals/R3b.md) -U0 -- src tests e2e | grep -E '^\+' | grep -vE '^\+\+\+' | grep -iE 'secret|api_key|rzp_(live|test)_[A-Za-z0-9]+|bearer [A-Za-z0-9]'` — expect: exit 1, no output — PASS if no added line holds those words or keys.

R3b-29. Typecheck — cmd: `npm run typecheck` — expect: exit 0 — PASS if exit 0.

R3b-30. Lint — cmd: `out=$(npm run lint 2>&1); rc=$?; echo "$out" | tail -15; test $rc -eq 0 && ! echo "$out" | grep -E '^/|\.(ts|tsx|css):[0-9]+' | grep -v 'src/app/layout.tsx'` — expect: exit 0 and no file listed other than `src/app/layout.tsx` — PASS if lint exits 0 and any listed warning is only for `src/app/layout.tsx` (pre-existing). A warning in any covers, shell or tests file is FAIL.

R3b-31. Whole unit suite — cmd: `npx vitest run` — expect: exit 0 — PASS if exit 0, no failed and no skipped test that was not skipped at `$(git log -1 --format=%H -- docs/build/evals/R3b.md)` (mock adapters, no database).
