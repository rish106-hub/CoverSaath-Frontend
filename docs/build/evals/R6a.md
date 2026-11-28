# R6a evals — Opening page

> Base for every diff is `B=$(git log -1 --format=%H -- docs/build/evals/R6a.md)` (resolved at run time). Run from the worktree root under bash. Playwright always as `KV_E2E_PORT=3313 npx playwright test -c playwright.real.config.ts ...`. Every "no line before `X-done`" check passes only if nothing prints before the marker.

R6a-01. Scope — cmd: `B=$(git log -1 --format=%H -- docs/build/evals/R6a.md); { git diff --name-only $B; git status --porcelain | grep '^??' | cut -c4-; } | sort -u | grep . | grep -vE '^(src/app/page\.tsx|src/components/public/(SignIn\.tsx|signin\.module\.css)|src/components/access/AccessCard(\.tsx|\.module\.css)|public/opening/family\.jpg|e2e/real-opening\.spec\.ts|tests/.*)$'; echo "stray-done"` — PASS if no line before `stray-done`.

R6a-02. Not-edited files unchanged — cmd: `B=$(git log -1 --format=%H -- docs/build/evals/R6a.md); git diff --name-only $B -- src/components/public/Landing.tsx src/components/public/landing.module.css src/components/public/Tour.tsx src/adapters src/app/api src/proxy.ts src/styles src/components/ui src/app/layout.tsx next.config.ts package.json package-lock.json e2e/real-calm.ts e2e/real-account.ts e2e/real-screens.spec.ts; echo "unchanged-done"` — PASS if no line before `unchanged-done`.

R6a-03. Typecheck and lint — cmd: `npm run typecheck > "${TMPDIR:-/tmp}/r6a-tc.txt" 2>&1; echo "typecheck rc=$?"; npm run lint > "${TMPDIR:-/tmp}/r6a-lint.txt" 2>&1; echo "lint rc=$?"; grep -E '[1-9][0-9]* errors?' "${TMPDIR:-/tmp}/r6a-lint.txt"; echo "lint-done"` — PASS if both rc are 0 and no error-count line prints before `lint-done`.

R6a-04. Styles obey the rules — cmd: `for C in src/components/public/signin.module.css src/components/access/AccessCard.module.css; do grep -nEi '#[0-9a-f]{3,8}\b|box-shadow|gradient|backdrop-filter|blur\(|@keyframes' $C | sed "s|^|$C: |"; grep -nE 'font-size: *([0-9]|1[0-5])(\.[0-9]+)?px' $C | sed "s|^|$C: |"; grep -nE 'font-weight: *([0-9]|[1-4][0-9][0-9])\b' $C | sed "s|^|$C: |"; grep -nE 'font: *(100|200|300|400|normal) ' $C | sed "s|^|$C: |"; grep -nE 'var\(--fs-1[0-5]\)' $C | sed "s|^|$C: |"; done; echo "css-done"` — PASS if no line before `css-done`.

R6a-05. Source rules — cmd: `F=src/components/public/SignIn.tsx; A=src/components/access/AccessCard.tsx; grep -nE 'ShowcasePanel|ThemeToggle|AUTH_WHYS|AUTH_CARDS|JOURNEY|useTicker|Private beta|Welcome to Knowvia' $F; grep -nE 'Get access|trialNote|Trial:' $A; grep -qF 'Health cover, finally clear.' $F || echo "NO PUNCH"; grep -qF '/opening/family.jpg' $F || echo "NO PHOTO"; grep -qF 'kv-app' $F || echo "NO kv-app"; grep -qF 'Sign in' $A || echo "NO Sign in"; grep -qF '<SignIn' src/app/page.tsx || echo "ROOT NOT SIGNIN"; test -s public/opening/family.jpg || echo "NO FILE"; echo "source-done"` — PASS if no line before `source-done`.

R6a-06. New unit tests — cmd: `npx vitest run tests/components/kv-opening.test.tsx 2>&1 | grep -E 'Tests +[0-9]+ passed|failed|skipped'` — PASS if the line reads `Tests  6 passed (6)` and nothing failed or skipped.

R6a-07. Whole unit suite — cmd: `npx vitest run 2>&1 | grep -E 'Test Files|Tests '` — PASS if no `failed` appears and the skipped count is 1 as before.

R6a-08. Opening harness — cmd: `KV_E2E_PORT=3313 npx playwright test -c playwright.real.config.ts e2e/real-opening.spec.ts 2>&1 | grep -E '^\s*[0-9]+ (passed|failed|skipped|flaky)|finding:'` — PASS if the only line is `4 passed`.

R6a-09. Every real spec — cmd: `KV_E2E_PORT=3313 npx playwright test -c playwright.real.config.ts > "${TMPDIR:-/tmp}/r6a-all.txt" 2>&1; echo "rc=$?"; grep -E '^\s*[0-9]+ (passed|failed|skipped|flaky)' "${TMPDIR:-/tmp}/r6a-all.txt"; grep -c 'finding:' "${TMPDIR:-/tmp}/r6a-all.txt"; lsof -nP -iTCP:3313 -sTCP:LISTEN; echo "port-done"` — PASS if `rc=0`, one summary line with only `passed`, finding count `0`, and no listener row before `port-done`.

R6a-10. Screenshots exist — cmd: `ls test-results/real/opening-1440x900.png test-results/real/opening-1280x800.png test-results/real/opening-1366x650.png` — PASS if all three are listed.
