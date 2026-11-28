# R4b evals — Harness upgrade: cut-off text, long names, smaller laptops, pay states

> Base for every diff is the literal `$(git log -1 --format=%H -- docs/build/evals/R4b.md)` (shell substitutes it). Run from the worktree root under bash or zsh. Written from spec R4b.1 to R4b.5, not from builder code. No database, no paid API, localhost only. Do not print `.env*`.
>
> Playwright always: `KV_E2E_PORT=3313 npx playwright test -c playwright.real.config.ts e2e/real-screens.spec.ts ...`.
> Shorthand: `S=e2e/real-screens.spec.ts`, `A=e2e/real-account.ts`.
> Measuring tests (titles 2, 5, 8, 9, 12, 13, 14) measure the product. A failure on a measured rule there is a FINDING to report (rule, element text, numbers, screenshot path), NOT a FAIL of this task. A harness error (fixture 404, locator timeout, skipped test, unhandled call) IS a FAIL.

R4b-01. Scope: changed plus untracked paths are only the two harness files — cmd: `{ git diff --name-only $(git log -1 --format=%H -- docs/build/evals/R4b.md); git ls-files --others --exclude-standard; } | sort -u | grep . | grep -vE '^(e2e/real-account\.ts|e2e/real-screens\.spec\.ts)$'; echo "stray-done"` — expect: no line before `stray-done` — PASS if every changed or untracked path is `e2e/real-account.ts` or `e2e/real-screens.spec.ts`.

R4b-02. Not-edited files unchanged — cmd: `git diff --name-only $(git log -1 --format=%H -- docs/build/evals/R4b.md) -- src tests playwright.config.ts playwright.real.config.ts package.json package-lock.json; echo "unchanged-done"` — expect: no line before `unchanged-done` — PASS if `src`, `tests`, both Playwright configs, `package.json` and `package-lock.json` do not differ from base.

R4b-03. real-account.ts has the new options and fixtures — cmd: `A=e2e/real-account.ts; for s in 'long' 'canAdd' 'verify' '"down"' 'order_e2e' 'rzp_test_e2e' '19900' 'BACKEND_UNREACHABLE' 'Example Comprehensive Family Health Protection Plan Platinum 2026' 'Example General Insurance Company Limited'; do grep -qF -- "$s" $A || echo "MISSING $s"; done; echo "strings-done"` — expect: no `MISSING` line before `strings-done` — PASS if all ten strings are present.

R4b-04. real-account.ts stays synthetic and never fulfils the real API — cmd: `A=e2e/real-account.ts; grep -n '/api/v1' $A; echo "--api-lines-above--"; grep -noE 'rzp_(test|live)_[A-Za-z0-9]+|sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{20,}|pay_[A-Za-z0-9]{14,}|[A-Za-z0-9]{32,}' $A | grep -v 'rzp_test_e2e'; echo "keys-done"; grep -ohE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' $A e2e/real-screens.spec.ts | grep -vE '@(example|company)\.com$'; echo "mail-done"` — expect: every `/api/v1` line above `--api-lines-above--` is an abort or record line, none on or next to a `fulfill` call; nothing before `keys-done`; nothing before `mail-done` — PASS if all three hold (the only key-like string is `rzp_test_e2e`, order ids start `order_e2e`, e-mail domains are only `example.com` or `company.com`).

R4b-05. Spec file: 17 pinned titles, 17 tests, old titles gone — cmd: `S=e2e/real-screens.spec.ts; while IFS= read -r t; do grep -qF -- "$t" $S || echo "MISSING TITLE $t"; done <<'EOF'
home shows the cover sentence and one next step for a real account
home is calm at every laptop size
my policies shows one card per policy and no pager for two
five policies page at four
my policies is calm at every laptop size
policy detail opens on At a glance and switches to a fact group
a group of nine facts pages at six
policy detail is calm on every tab at every laptop size
the wizard is calm on every step at every laptop size
under 1024px wide the laptop gate shows and the app is hidden
no call reaches the backend API and no app call is unhandled
long names and three open details stay inside their cards on home, list and detail
below 640px tall nothing is cut off on home, list and detail
the pay screen shows the price and is calm at every laptop size
closing the payment window shows the reason and offers Pay again
a confirmed payment moves on with the paid notice
an unconfirmed payment offers Check again and no Pay button
EOF
grep -cE '^\s*test\(' $S; grep -nE 'at 1440x900 and 1280x800|is calm on every step at 1440x900' $S; echo "titles-done"` — expect: no `MISSING TITLE` line, then `17`, then no line before `titles-done` — PASS if all 17 titles are verbatim, exactly 17 `test(` declarations, and no old "at 1440x900 and 1280x800" or "is calm on every step at 1440x900" title remains.

R4b-06. Spec file: no skipped tests, no new exemption — cmd: `S=e2e/real-screens.spec.ts; grep -nE 'test\.(skip|fixme|only)|\.only\(' $S; grep -nE 'data-clamp|data-allow|skipClip' $S e2e/real-account.ts; echo "forbidden-done"; grep -c 'data-panel="terms"' $S` — expect: no line before `forbidden-done`, then a count of at least 1 — PASS if no `test.skip`, `test.fixme`, `.only`, `data-clamp`, `data-allow` or `skipClip` exists and the single pinned `[data-panel="terms"]` exemption remains.

R4b-07. Spec file: helper, sizes, cut-off rules, old rules, screenshots calm — cmd: `S=e2e/real-screens.spec.ts; for s in 'expectNothingCutOff' 'addInitScript' '1366' '650' '560' 'overflow' 'hidden' 'clip' 'scrollWidth' 'clientWidth' 'getBoundingClientRect' 'scrollHeight' 'clientHeight' 'fontSize' 'fontWeight' '16' '500'; do grep -qF -- "$s" $S || echo "MISSING $s"; done; grep -nE '(function|const) expectNothingCutOff' $S | head -1; perl -0ne 'while(/page\.screenshot\(\{.*?\}\)/gs){$n++; $b++ unless $&=~/animations:\s*"disabled"/} print "calls=",$n+0," bad=",$b+0,"\n"' $S; echo "rules-done"` — expect: no `MISSING` line, one definition line for `expectNothingCutOff`, `calls=N bad=0` with N at least 1, then `rules-done` — PASS if all strings present, the helper is defined, and every `page.screenshot(` call has `animations: "disabled"`.

R4b-08. Behaviour tests pass (titles 1, 3, 4, 6, 7, 10, 11, 15, 16, 17) — cmd: `KV_E2E_PORT=3313 npx playwright test -c playwright.real.config.ts e2e/real-screens.spec.ts --reporter=line -g 'home shows the cover sentence and one next step for a real account|my policies shows one card per policy and no pager for two|five policies page at four|policy detail opens on At a glance and switches to a fact group|a group of nine facts pages at six|under 1024px wide the laptop gate shows and the app is hidden|no call reaches the backend API and no app call is unhandled|closing the payment window shows the reason and offers Pay again|a confirmed payment moves on with the paid notice|an unconfirmed payment offers Check again and no Pay button'; echo "rc=$?"` — expect: `10 passed`, no failed, no skipped, `rc=0` — PASS if all ten pass.

R4b-09. Measuring tests ran cleanly (titles 2, 5, 8, 9, 12, 13, 14) — cmd: `KV_E2E_PORT=3313 npx playwright test -c playwright.real.config.ts e2e/real-screens.spec.ts --reporter=list -g 'home is calm at every laptop size|my policies is calm at every laptop size|policy detail is calm on every tab at every laptop size|the wizard is calm on every step at every laptop size|long names and three open details stay inside their cards on home, list and detail|below 640px tall nothing is cut off on home, list and detail|the pay screen shows the price and is calm at every laptop size' 2>&1 | tee "${TMPDIR:-/tmp}/r4b-measure.txt" | tail -80; echo "rc=${PIPESTATUS[0]:-$?}"; grep -ciE '^\s*-\s|skipped|404|locator|Timeout|waiting for|unhandled' "${TMPDIR:-/tmp}/r4b-measure.txt"` — expect: seven tests listed as run (passed or failed, none skipped); any failure message names a measured rule (not cut off by a container, not cut off by itself, font size, font weight, scroll) with element text and numbers; last number (harness-error line count) is `0` — PASS if all seven ran and no harness error appears. A product-rule failure is a FINDING to report (rule, element text, numbers, screenshot path under `test-results/real/`), not a FAIL.

R4b-10. Typecheck and lint — cmd: `npm run typecheck; echo "tc-rc=$?"; npm run lint 2>&1 | tee "${TMPDIR:-/tmp}/r4b-lint.txt" | tail -20; echo "lint-rc=${PIPESTATUS[0]:-$?}"; grep -E '^/|^\./|\.(ts|tsx|js|mjs|css):' "${TMPDIR:-/tmp}/r4b-lint.txt" | grep -v 'src/app/layout.tsx'; echo "lint-files-done"` — expect: `tc-rc=0`, `lint-rc=0`, no file line before `lint-files-done` other than `src/app/layout.tsx` — PASS if typecheck and lint exit 0 and no file other than `src/app/layout.tsx` is listed.

R4b-11. No server left behind — cmd: `lsof -nP -iTCP:3313 -sTCP:LISTEN; echo "listen-done"` — expect: no line before `listen-done` — PASS if nothing listens on port 3313 after the runs.
