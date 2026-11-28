# R3s evals — No "Coming soon" blocks and no eyebrow captions (Kicker) for real accounts

> Base for every diff check is the literal token `$(git log -1 --format=%H -- docs/build/evals/R3s.md)` (substituted before running). Run all commands from the worktree root under bash or zsh. Written from the R3s spec (R3s.1 to R3s.3), not from builder code. No database, no paid API, no network. Do not print `.env*`. No `scripts/verify.sh` check. Paths with parentheses are quoted.
> Shorthand: `T=tests/components/kv-no-soon.test.tsx`, `A="src/app/(app)"`.

R3s-01. Scope: changed plus untracked paths are a subset of the allowed set — cmd: `{ git diff --name-only $(git log -1 --format=%H -- docs/build/evals/R3s.md); git ls-files --others --exclude-standard; } | sort -u | grep . | grep -vxE 'src/app/\(app\)/(family|money|tools|stress-test|compare|emergency|desk|cards)/page\.tsx|src/components/help/HelpHead\.tsx|src/components/shell/PagePlaceholder\.tsx|src/components/help/SettingsView\.tsx|tests/.*'; echo "stray-done"; test -s tests/components/kv-no-soon.test.tsx || echo "MISSING new test"` — expect: output is exactly `stray-done` — PASS if no path outside the 11 source files and `tests/` changed or is untracked, and the new test file exists and is non-empty.

R3s-02. Not-edited paths unchanged — cmd: `git diff --stat $(git log -1 --format=%H -- docs/build/evals/R3s.md) -- src/components/soon src/components/ui src/components/type src/lib/ia.ts src/components/tools/ToolsPage.tsx src/app/dev src/app/status src/app/not-found.tsx src/components/shell/EmptyState.tsx src/styles/tokens.css src/components/landing package.json package-lock.json | wc -l | tr -d ' '` — expect: output `0` — PASS if none of those paths differ from base.

R3s-03. No SoonBento anywhere under the app route group — cmd: `grep -rl 'SoonBento' "src/app/(app)"; echo done` — expect: output is exactly `done` — PASS if no file under `src/app/(app)` contains `SoonBento`.

R3s-04. No Kicker under the app route group, nor in HelpHead or PagePlaceholder — cmd: `grep -rl 'Kicker' "src/app/(app)" src/components/help/HelpHead.tsx src/components/shell/PagePlaceholder.tsx; echo done` — expect: output is exactly `done` — PASS if none of those paths contains `Kicker`.

R3s-05. Four pages carry the pinned real-family `empty` values — cmd: `grep -qF 'empty={<RealFamily />}' "src/app/(app)/family/page.tsx" && grep -qF 'empty={<RealMoney />}' "src/app/(app)/money/page.tsx" && grep -qF 'empty={<RealStress />}' "src/app/(app)/stress-test/page.tsx" && grep -qF 'empty={<RealCompare />}' "src/app/(app)/compare/page.tsx" && echo empties-ok` — expect: output `empties-ok` — PASS if each of the four files contains its exact `empty={...}` string.

R3s-06. Emergency keeps EmergencyLive; desk and cards show the not-available state — cmd: `grep -qF 'EmergencyLive' "src/app/(app)/emergency/page.tsx" && ! grep -q 'SoonBento' "src/app/(app)/emergency/page.tsx"; e=$?; for p in desk cards; do f="src/app/(app)/$p/page.tsx"; for s in 'This page is not available.' 'Go to Home' 'href="/home"'; do grep -qF -- "$s" "$f" || { echo "MISSING $s in $p"; e=1; }; done; done; test $e -eq 0 && echo gates-ok` — expect: output `gates-ok` — PASS if emergency contains `EmergencyLive` and not `SoonBento`, and desk and cards each contain all three pinned strings.

R3s-07. SettingsView drops Voice language and SoonButton, keeps Reduce motion — cmd: `F=src/components/help/SettingsView.tsx; ! grep -qF 'Voice language' $F && ! grep -q 'SoonButton' $F && grep -qF 'Reduce motion' $F && echo settings-ok` — expect: output `settings-ok` — PASS if `Voice language` and `SoonButton` are absent and `Reduce motion` is present.

R3s-08. The ia registry still has kicker fields — cmd: `grep -c 'kicker' src/lib/ia.ts` — expect: output a number of 1 or more (and R3s-02 shows the file unchanged) — PASS if the count is at least 1.

R3s-09. New test file has the 6 titles verbatim, exactly 6 `it(` calls, none skipped — cmd: `T=tests/components/kv-no-soon.test.tsx; for s in '"no page under src/app/(app) imports SoonBento"' '"no page under src/app/(app) renders a Kicker"' '"HelpHead and PagePlaceholder render the title without a kicker"' '"desk and cards show This page is not available with a link to Home for a real account"' '"settings has no Voice language row and no Soon button"' '"the ia registry still carries its kicker fields"'; do grep -qF -- "$s" $T || { echo "MISSING $s"; exit 1; }; done; n=$(grep -cE '(^|[^A-Za-z_.])it\(' $T); echo "it-count=$n"; grep -nE '\.(skip|todo|only)\(|\bxit\(|\bxdescribe\(|\bit\.skip|\bit\.todo' $T; echo titles-ok` — expect: output is `it-count=6` then `titles-ok`, with no match line between them — PASS if all 6 titles exist, the count is exactly 6, and no skip, todo, only or x-variant appears.

R3s-10. New test file passes all 6 — cmd: `npx vitest run tests/components/kv-no-soon.test.tsx 2>&1 | tail -15` — expect: exit 0, output matches `Tests  6 passed (6)` and no `skipped`, `todo` or `failed` — PASS if exactly 6 tests ran and all passed.

R3s-11. No test file deleted vs base — cmd: `git diff --diff-filter=D --name-only $(git log -1 --format=%H -- docs/build/evals/R3s.md)` — expect: empty output — PASS if nothing prints (edited tests stay, only their assertions change).

R3s-12. Typecheck — cmd: `npm run typecheck; echo "rc=$?"` — expect: last line `rc=0` — PASS if exit 0.

R3s-13. Lint clean apart from the known layout warning — cmd: `out=$(npm run lint 2>&1); echo "rc=$?"; echo "$out" | grep -oE '(\./)?src/[^ :]+' | sort -u | grep -v 'src/app/layout.tsx$'; echo done` — expect: `rc=0`, then only `done` (no file path line) — PASS if lint exits 0 and no file other than `src/app/layout.tsx` is listed.

R3s-14. Whole unit suite passes — cmd: `npx vitest run 2>&1 | tail -15` — expect: exit 0, output shows `Test Files` and `Tests` lines with no `failed` — PASS if every unit test passes, including edited t5, t6 and soon-controls tests.
