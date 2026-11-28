# R3e evals — My policies list (`/policies`) and policy detail (`/policies/[id]`): card grid, header plus tabs

> Base for every diff check is the literal token `$(git log -1 --format=%H -- docs/build/evals/R3e.md)` (substituted before running). Run all commands from the worktree root under bash or zsh. Source of truth: R3e spec (R3e.1 to R3e.7). Written from the spec, not from the builder's code. No database, no paid API, no network. Do not print `.env*`. Playwright is not run in this task.
>
> Vitest named checks: PASS needs exit 0 and output matching `1 passed` (a zero-match run or a skipped test is FAIL). Titles are matched with `-t` as regex; the titles below contain no regex metacharacters except commas and spaces, which are literal. Shorthand: `L=src/components/cover-real/RealPolicies.tsx`, `D=src/components/cover-real/RealPolicyDetail.tsx`, `S=src/components/cover-real/policies.module.css`, `T=tests/components/kv-policies.test.tsx`.

## A. Scope

R3e-01. Changed plus untracked paths are a subset of the R3e.1 table and the two new files exist — cmd: `{ git diff --name-only $(git log -1 --format=%H -- docs/build/evals/R3e.md); git ls-files --others --exclude-standard; } | sort -u | grep . | grep -vxE 'src/components/cover-real/RealPolicies\.tsx|src/components/cover-real/RealPolicyDetail\.tsx|src/components/cover-real/policies\.module\.css|tests/components/kv-policies\.test\.tsx|tests/adapters/real-policy\.test\.tsx|tests/components/real-policy-detail\.test\.tsx|tests/components/wording-cutover\.test\.tsx|tests/components/t12-numbers-first\.test\.tsx'; echo "stray-done"; test -s src/components/cover-real/policies.module.css || echo "MISSING css"; test -s tests/components/kv-policies.test.tsx || echo "MISSING kv-policies"` — expect: output is exactly `stray-done` — PASS if no path outside the 8 table rows changed or is untracked, and both new files exist and are non-empty.

R3e-02. Not-edited paths unchanged — cmd: `git diff --stat $(git log -1 --format=%H -- docs/build/evals/R3e.md) -- src/components/cover-real/parts.tsx src/components/cover-real/MemoryDocument.tsx src/components/cover-real/PassageSearch.tsx src/components/cover-real/use-policies.ts src/components/covers src/adapters src/components/ui src/app src/styles/tokens.css src/components/landing package.json package-lock.json | wc -l | tr -d ' '` — expect: output `0` — PASS if none of those paths differ from base (no shared-part, adapter, token, landing or dependency change).

## B. List markup (R3e.2)

R3e-03. Pinned strings and attributes verbatim in RealPolicies.tsx, PolicyCard gone — cmd: `L=src/components/cover-real/RealPolicies.tsx; for s in 'data-testid="policy-count"' 'data-testid="policy-card"' 'PAGE_SIZE = 4' 'Add a policy' '/covers/add' 'Back' 'Next' 'Page ' 'Needs your decision' 'Not found yet' 'Could not load. Open to try again.' 'Still being read' 'Tell us which plan this is' 'One detail needs your decision' ' details need your decision' 'Read and ready'; do grep -qF -- "$s" $L || { echo "MISSING $s"; exit 1; }; done; ! grep -nw 'PolicyCard' $L && echo list-strings-ok` — expect: output `list-strings-ok` — PASS if all 16 strings are present in `RealPolicies.tsx` and the identifier `PolicyCard` appears nowhere in it (import or use).

## C. Detail markup (R3e.3)

R3e-04. Pinned strings present, removed names absent, refresh effect kept — cmd: `D=src/components/cover-real/RealPolicyDetail.tsx; for s in 'Tabs' 'label="Policy sections"' 'role="tabpanel"' 'data-panel' 'hidden=' 'FACT_PAGE = 8' 'At a glance' 'Not found' 'Insurer terms' 'All policies' '/policies' 'Ask about this policy' '/chat?holding=' 'Nothing has been read from this policy yet.' 'TermsStatus' 'MemoryDocument' 'PassageSearch' 'setInterval'; do grep -qF -- "$s" $D || { echo "MISSING $s"; exit 1; }; done; ! grep -nE 'SectionHeading|<details|k-btn' $D && echo detail-strings-ok` — expect: output `detail-strings-ok` — PASS if all 18 strings are in `RealPolicyDetail.tsx` and none of `SectionHeading`, `<details`, `k-btn` appears.

## D. CSS (R3e.4)

R3e-05. Two equal columns, 24px gap, `.cta` and `.outline` exist — cmd: `S=src/components/cover-real/policies.module.css; grep -qE 'grid-template-columns:[[:space:]]*repeat\(2,[[:space:]]*minmax\(0,[[:space:]]*1fr\)\)' $S && grep -qE 'gap:[[:space:]]*24px' $S && grep -qE '^[[:space:]]*\.cta[[:space:]{,.:]' $S && grep -qE '^[[:space:]]*\.outline[[:space:]{,.:]' $S && echo css-grid-ok` — expect: output `css-grid-ok` — PASS if a two-equal-column grid, a `gap: 24px`, and both `.cta` and `.outline` selectors are declared.

R3e-06. No banned visual effects — cmd: `S=src/components/cover-real/policies.module.css; grep -nE '#[0-9a-fA-F]{3,8}\b|box-shadow|gradient|backdrop-filter|blur\(|@keyframes' $S; echo "done rc-ignored"` — expect: output is exactly `done rc-ignored` (no match line before it) — PASS if the stylesheet has no hex colour, `box-shadow`, gradient, `backdrop-filter`, `blur(` or `@keyframes`.

R3e-07. No small text, no light weight — cmd: `S=src/components/cover-real/policies.module.css; grep -ohE 'font-size:[[:space:]]*[0-9.]+(px|rem)' $S | awk '{v=$0; sub(/.*:[ \t]*/,"",v); n=v+0; if(v ~ /rem/) n*=16; if(n<16) bad=1} END{exit bad}' && grep -ohE 'font-weight:[[:space:]]*[0-9]+' $S | awk '{v=$0; sub(/.*:[ \t]*/,"",v); if(v+0<500) bad=1} END{exit bad}' && ! grep -qE 'font-weight:[[:space:]]*(normal|lighter)' $S && echo type-ok` — expect: output `type-ok` — PASS if every `font-size` is at least 16px (rem counted at 16px) and every `font-weight` is at least 500.

## E. New tests (R3e.5)

R3e-08. Exactly 15 `it(` calls, none skipped, 15 pinned titles verbatim in double quotes — cmd: `T=tests/components/kv-policies.test.tsx; [ "$(grep -cE '(^|[^A-Za-z_.])it\(' $T)" = 15 ] && ! grep -nE 'it\.(skip|todo|only)|xit\(|describe\.skip|test\.skip' $T && while IFS= read -r t; do grep -qF -- "\"$t\"" $T || { echo "MISSING $t"; exit 1; }; done <<'EOF'
the list shows the count and an Add a policy link
each policy is one card that links to its page
headline tones map to green and yellow signals
the state signal follows error, reading, choose plan, pending, ready in that order
four or fewer policies show no pager
a fifth policy moves to page two and Back returns
loading, error and empty list states are unchanged
detail starts on At a glance with the stage note, pending note and headlines
detail has one tab per fact group that has facts, in the fixed order
choosing a group tab shows its facts and hides the others
a group with nine facts pages at eight
Not found tab shows the count and the labels
Insurer terms tab appears only when the policy is ready or needs review
detail header links to all policies and to ask about this policy
policy not found and detail error states are unchanged
EOF
echo titles-ok` — expect: output `titles-ok` — PASS if there are exactly 15 `it(` calls, none skipped, todo or only, and all 15 titles appear verbatim in double quotes.

R3e-09. All 15 new tests pass — cmd: `npx vitest run tests/components/kv-policies.test.tsx 2>&1 | tail -15` — expect: output contains `15 passed` and no `failed` or `skipped` — PASS if exit 0, `15 passed`, and zero failed or skipped.

## F. Failure paths and unchanged states (named titles)

R3e-10. Error and reading state signal order — cmd: `npx vitest run tests/components/kv-policies.test.tsx -t 'the state signal follows error, reading, choose plan, pending, ready in that order' 2>&1 | tail -15` — expect: exit 0 and output matches `1 passed` — PASS if that one test runs and passes (error beats reading beats choose plan beats pending beats ready).

R3e-11. Loading, error and empty list unchanged — cmd: `npx vitest run tests/components/kv-policies.test.tsx -t 'loading, error and empty list states are unchanged' 2>&1 | tail -15` — expect: exit 0 and output matches `1 passed` — PASS if that one test runs and passes.

R3e-12. Policy not found and detail error unchanged — cmd: `npx vitest run tests/components/kv-policies.test.tsx -t 'policy not found and detail error states are unchanged' 2>&1 | tail -15` — expect: exit 0 and output matches `1 passed` — PASS if that one test runs and passes.

R3e-13. No pager at four, pager at five — cmd: `npx vitest run tests/components/kv-policies.test.tsx -t 'four or fewer policies show no pager|a fifth policy moves to page two and Back returns' 2>&1 | tail -15` — expect: exit 0 and output matches `2 passed` — PASS if both tests run and pass.

## G. Existing tests keep every title (R3e.6)

R3e-14. Every `it(` title that exists at base still exists in the four listed files — cmd: `B=$(git log -1 --format=%H -- docs/build/evals/R3e.md); for f in tests/adapters/real-policy.test.tsx tests/components/real-policy-detail.test.tsx tests/components/wording-cutover.test.tsx tests/components/t12-numbers-first.test.tsx; do git show $B:$f | grep -ohE "(^|[^A-Za-z_.])it\((\"[^\"]*\"|'[^']*'|\`[^\`]*\`)" | sed -E 's/^[^i]*it\(//' | sort -u > /dev/null; git show $B:$f | grep -ohE "it\((\"[^\"]*\"|'[^']*'|\`[^\`]*\`)" | sort -u > "${TMPDIR:-/tmp}/r3e-base.txt"; grep -ohE "it\((\"[^\"]*\"|'[^']*'|\`[^\`]*\`)" $f | sort -u > "${TMPDIR:-/tmp}/r3e-now.txt"; echo "$f base=$(wc -l < ${TMPDIR:-/tmp}/r3e-base.txt | tr -d ' ')"; comm -23 "${TMPDIR:-/tmp}/r3e-base.txt" "${TMPDIR:-/tmp}/r3e-now.txt" | sed 's/^/LOST /'; done; echo "titles-done"` — expect: no line starting `LOST`, and each file line shows `base=` greater than 0 — PASS if no `LOST` line is printed.

R3e-15. The four existing files still pass — cmd: `npx vitest run tests/adapters/real-policy.test.tsx tests/components/real-policy-detail.test.tsx tests/components/wording-cutover.test.tsx tests/components/t12-numbers-first.test.tsx 2>&1 | tail -15` — expect: exit 0, output contains `4 passed` for files, no `failed` — PASS if all four files pass with zero failed and zero skipped added versus base.

## H. Gates

R3e-16. Typecheck — cmd: `npm run typecheck` — expect: exit 0 — PASS if zero errors.

R3e-17. Lint clean except the known layout file — cmd: `npm run lint 2>&1 | tee "${TMPDIR:-/tmp}/r3e-lint.txt"; test ${PIPESTATUS[0]:-${pipestatus[1]}} -eq 0; echo "rc=$?"; grep -E '^/|^[A-Za-z0-9_./\[\]-]+\.(ts|tsx|css|js|mjs)' "${TMPDIR:-/tmp}/r3e-lint.txt" | grep -vE 'src/app/layout\.tsx'; echo lint-done` — expect: `rc=0` and no file path listed before `lint-done` other than `src/app/layout.tsx` — PASS if lint exits 0 (warnings allowed only on `src/app/layout.tsx`) and names no other file.

R3e-18. Whole unit suite — cmd: `npx vitest run 2>&1 | tail -20` — expect: exit 0, output contains `passed` and no `failed` — PASS if every unit test file passes with none failing.
