# R3d evals — Home (`/home`): two equal halves, cover sentence plus one next step, three right cards

> Base for every diff check is the literal token `$(git log -1 --format=%H -- docs/build/evals/R3d.md)` (substituted before running). Run all commands from the worktree root under bash or zsh. Source of truth: R3d spec (R3d.1 to R3d.7). Written from the spec, not from the builder's code. No database, no paid API, no network. Do not print `.env*`. Playwright is not run in this task.
>
> Vitest named checks: PASS needs exit 0 and output matching `1 passed` (a zero-match run or a skipped test is FAIL). Titles are matched with `-t` as regex; titles with regex metacharacters are escaped below. Shorthand: `R=src/components/cover-real/RealHome.tsx`, `S=src/components/cover-real/RealHome.module.css`, `G=src/components/shell/HomeGreeting.tsx`, `T=tests/components/kv-home.test.tsx`.

## A. Scope

R3d-01. Changed plus untracked paths are a subset of the R3d.1 table and the new test exists — cmd: `{ git diff --name-only $(git log -1 --format=%H -- docs/build/evals/R3d.md); git ls-files --others --exclude-standard; } | sort -u | grep . | grep -vxE 'src/components/cover-real/RealHome\.tsx|src/components/cover-real/RealHome\.module\.css|src/components/shell/HomeGreeting\.tsx|tests/components/kv-home\.test\.tsx|tests/components/t3-home\.test\.tsx|tests/components/t12-numbers-first\.test\.tsx|tests/adapters/real-policy\.test\.tsx|tests/components/remaining-states-112\.test\.tsx|tests/components/t2-greeting-chip\.test\.tsx'; echo "stray-done"; test -s tests/components/kv-home.test.tsx || echo "MISSING kv-home"` — expect: output is exactly `stray-done` — PASS if no path outside the 9 table rows changed or is untracked and `tests/components/kv-home.test.tsx` exists and is non-empty.

R3d-02. Not-edited paths unchanged — cmd: `git diff --stat $(git log -1 --format=%H -- docs/build/evals/R3d.md) -- src/app src/components/cover-real/parts.tsx src/components/cover-real/use-policies.ts src/adapters src/components/ui src/components/cover/HomeView.tsx src/styles/tokens.css src/components/landing package.json package-lock.json | wc -l | tr -d ' '` — expect: output `0` — PASS if none of those paths differ from base (no new dependency, no adapter, landing or token change).

## B. CSS (R3d.2)

R3d-03. Pinned grid, gap, size declarations — cmd: `S=src/components/cover-real/RealHome.module.css; [ "$(grep -cE 'grid-template-columns:[[:space:]]*repeat\(2,[[:space:]]*minmax\(0,[[:space:]]*1fr\)\)' $S)" -ge 1 ] && [ "$(grep -cE 'grid-template-rows:[[:space:]]*repeat\(3,[[:space:]]*minmax\(0,[[:space:]]*1fr\)\)' $S)" -ge 1 ] && [ "$(grep -cE 'gap:[[:space:]]*24px' $S)" -ge 3 ] && grep -qE 'font-size:[[:space:]]*44px' $S && grep -qE 'font-size:[[:space:]]*32px' $S && grep -qE 'padding:[[:space:]]*32px' $S && grep -qE 'padding:[[:space:]]*24px' $S && echo grid-ok` — expect: output `grid-ok` — PASS if two equal columns, three equal rows, at least three `gap: 24px` (home, left, right), 44px sentence, 32px value and both paddings are declared.

R3d-04. No banned visual effects — cmd: `S=src/components/cover-real/RealHome.module.css; grep -nE '#[0-9a-fA-F]{3,8}\b|box-shadow|gradient|backdrop-filter|blur\(|@keyframes' $S; echo "done rc-ignored"` — expect: output is exactly `done rc-ignored` (no match line before it) — PASS if the stylesheet has no hex colour, `box-shadow`, gradient, `backdrop-filter`, `blur(` or `@keyframes`.

R3d-05. No small text, no light weight — cmd: `S=src/components/cover-real/RealHome.module.css; grep -ohE 'font-size:[[:space:]]*[0-9.]+(px|rem)' $S | awk '{v=$0; sub(/.*:[ \t]*/,"",v); n=v+0; if(v ~ /rem/) n*=16; if(n<16) bad=1} END{exit bad}' && grep -ohE 'font-weight:[[:space:]]*[0-9]+' $S | awk '{v=$0; sub(/.*:[ \t]*/,"",v); if(v+0<500) bad=1} END{exit bad}' && ! grep -qE 'font-weight:[[:space:]]*(normal|lighter)' $S` — expect: exit 0 — PASS if every `font-size` is at least 16px (rem counted at 16px) and every `font-weight` is at least 500.

## C. Markup (R3d.3, R3d.4)

R3d-06. Pinned strings and test ids present verbatim in RealHome.tsx — cmd: `R=src/components/cover-real/RealHome.tsx; for s in 'You have ' ' of health cover.' 'Your policy is on Knowvia.' ' policies on Knowvia.' 'Policies' 'Next renewal' 'Not in your policy' 'On your policy' 'Add it from your policy page' 'Ask about your cover' 'What are my waiting periods?' 'What does my policy not cover?' '/policies' '/chat?q=' 'data-testid="home-cover"' 'data-testid="home-next"' 'var(--harbour)'; do grep -qF -- "$s" $R || { echo "MISSING $s"; exit 1; }; done; grep -q 'encodeURIComponent' $R && grep -qE 'kind="ok"' $R && grep -qE 'kind="warn"' $R && echo strings-ok` — expect: output `strings-ok` — PASS if all 17 strings, `encodeURIComponent`, and both Signal kinds are in `RealHome.tsx`.

R3d-07. Removed names and strings absent — cmd: `R=src/components/cover-real/RealHome.tsx; ! grep -nwE 'SectionHeading|BentoGrid|Tile|MissingTile|SoonTile|AskCard' $R && ! grep -nF -e 'Cover per person' -e 'Your cover at a glance' $R && echo removed-ok` — expect: output `removed-ok` — PASS if none of the six identifiers or two strings appear in `RealHome.tsx`.

R3d-08. Greeting date line removed, fade class kept — cmd: `G=src/components/shell/HomeGreeting.tsx; ! grep -q 'Kicker' $G && grep -qF 'className="k-no-fade"' $G && echo greeting-ok` — expect: output `greeting-ok` — PASS if `Kicker` is gone and `className="k-no-fade"` remains.

R3d-09. Other states kept — cmd: `R=src/components/cover-real/RealHome.tsx; for s in '<Loading what="your cover"' '<ErrorBox' 'Add your first policy' 'Knowvia reads it and shows what it found here.' 'Add a policy' '/covers/add' '<EmptyState' '<CreationIssues'; do grep -qF -- "$s" $R || { echo "MISSING $s"; exit 1; }; done; echo states-ok` — expect: output `states-ok` — PASS if the loading, error, empty strings and components and `CreationIssues` are all present.

## D. New tests (R3d.5)

R3d-10. kv-home test file shape — cmd: `T=tests/components/kv-home.test.tsx; for t in "one policy with a sum insured reads as one sentence" "one policy without a sum insured says the policy is on Knowvia" "two policies show the count and never add values together" "the next step is the only primary action and links to the next step" "the policies card links to My policies and lists at most two titles" "a third policy shows and 1 more" "renewal found shows the date with a green signal" "renewal missing shows Not in your policy with a yellow signal" "ask has two prompts that link to chat with the question" "home has no Soon tile and no Cover per person" "loading, error and empty states are unchanged" "the greeting has no date line"; do grep -qF "\"$t\"" $T || { echo "MISSING $t"; exit 1; }; done; [ "$(grep -cE '\bit\(' $T)" -eq 12 ] && ! grep -nE 'it\.(skip|todo|only)|\bxit\(|describe\.skip|test\.skip' $T && echo shape-ok` — expect: output `shape-ok` — PASS if all 12 titles appear verbatim in double quotes, exactly 12 `it(` calls exist, and none is skipped, todo or only.

R3d-11. kv-home all pass — cmd: `npx vitest run tests/components/kv-home.test.tsx` — expect: exit 0 and output matching `12 passed` — PASS if 12 passed, 0 failed, 0 skipped.

R3d-12. Failure path: renewal missing and two policies never add — cmd: `npx vitest run tests/components/kv-home.test.tsx -t "renewal missing shows Not in your policy with a yellow signal|two policies show the count and never add values together"` — expect: exit 0 and output matching `2 passed` — PASS if both named tests pass.

R3d-13. Failure path: loading, error, empty unchanged — cmd: `npx vitest run tests/components/kv-home.test.tsx -t "loading, error and empty states are unchanged"` — expect: exit 0 and output matching `1 passed` — PASS if that test passes.

## E. Existing tests (R3d.6)

R3d-14. Touch-target test untouched and passing; kept t3-home titles present — cmd: `git diff --quiet $(git log -1 --format=%H -- docs/build/evals/R3d.md) -- tests/styles/touch-targets-84.test.ts && for t in "ask card has two prompts" "no policy cards on Home" "single primary CTA"; do grep -qF "$t" tests/components/t3-home.test.tsx || { echo "MISSING $t"; exit 1; }; done && npx vitest run tests/styles/touch-targets-84.test.ts tests/components/t3-home.test.tsx` — expect: exit 0 and output with no `failed` — PASS if `touch-targets-84.test.ts` is byte-identical to base, the three titles exist in `t3-home.test.tsx`, and both files pass.

## F. Gates

R3d-15. typecheck — cmd: `npm run typecheck` — expect: exit 0 — PASS if exit 0.

R3d-16. lint — cmd: `o=$(mktemp); npm run lint >$o 2>&1; rc=$?; grep -E '\.(tsx?|jsx?|mjs|css)' $o | grep -vE '^>' | grep -v 'src/app/layout.tsx'; echo "rc=$rc"; rm -f $o` — expect: output is exactly `rc=0` — PASS if lint exits 0 and no file path other than `src/app/layout.tsx` appears in its output.

R3d-17. whole unit suite — cmd: `npx vitest run` — expect: exit 0 and output with `0 failed` (no `failed` line) — PASS if every unit test file passes, including `real-policy`, `t12-numbers-first`, `remaining-states-112`, `t2-greeting-chip`.
