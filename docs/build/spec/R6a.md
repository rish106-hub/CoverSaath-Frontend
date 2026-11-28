# R6a Opening page: one punch line, sign in, a sunny family photograph

Owner brief (2026-11-28): the opening page has no excitement. It must look fresh and bright: a photograph of an Indian family with a child on the right, a punch line of at most five words, no hairline text, and normal sign in or sign in with Google.

Scope: `/` and `/signin` both show the same opening screen. Sign-in behaviour (Google link, name and email access, waitlist `?email=` auto sign-in, return path, demo password field, OTP and email-link steps in mock mode, every error message) is unchanged. Only layout, copy and styles change.

Persona served: a 25 to 35 year old tech worker in an Indian city opening Knowvia for the first time on a laptop. In one glance: what this is, a warm picture, and one obvious way in.

Photograph: `public/opening/family.jpg` (already in the tree; a family of three in a green park, Pexels photo 33433751, free to use under the Pexels licence, no attribution required). No caption or credit on screen.

## R6a.1 Files

| File | Change |
|---|---|
| `src/app/page.tsx` | Renders `<SignIn />`. `metadata.title` is `Knowvia`. |
| `src/components/public/SignIn.tsx` | Layout rewritten (R6a.2). All handlers, steps and adapters calls stay. `ShowcasePanel`, the journey list, the `AUTH_WHYS` row, `ThemeToggle`, `useTicker`, `useReducedMotion`, the wide-screen store and their imports are removed. `DemoCard` and `OtpBoxes` stay. |
| `src/components/public/signin.module.css` | Rewritten (R6a.3). |
| `src/components/access/AccessCard.tsx` | Copy and class changes only (R6a.2 item 4). Logic untouched. |
| `src/components/access/AccessCard.module.css` | Rewritten to the R6a.3 rules. |
| `public/opening/family.jpg` | New (already placed; commit it). |
| `e2e/real-opening.spec.ts` | New (R6a.4). |
| `tests/components/kv-opening.test.tsx` | New (R6a.5). |
| `tests/components/signin-showcase.test.tsx` | Its three tests are replaced by one: `the opening page has no showcase, pause control or rotating headline`. File kept. |
| `tests/app/stability.test.tsx`, `tests/components/signin-return.test.tsx`, `access-busy.test.tsx`, `legal-links.test.tsx`, `tests/styles/tokens.test.ts`, other unit tests that fail only because of a change pinned here | Updated to the pinned markup and copy. Titles kept. |

Not edited: `Landing.tsx`, `landing.module.css`, `Tour.tsx` (now unused; removal is a later clean-up), `otp.ts`, `validate.ts`, adapters, `src/app/api`, `src/proxy.ts`, `src/styles/*`, `src/components/ui/*`, `src/app/layout.tsx`, `next.config.ts`, `package.json`, `e2e/real-calm.ts`, `e2e/real-account.ts`, `e2e/real-screens.spec.ts`.

## R6a.2 Layout and copy

1. Root `<div className={`kv-app ${styles.page}`}>`: grid of two equal columns, `height: 100dvh`, background `var(--mist)`. No page scroll at 1024px wide and above and 640px tall and above.
2. Left `<main className={styles.left}>`: flex column, padding 40px 64px.
   - Top: `<BrandMark href="/" size={32} />`.
   - Middle (`flex: 1`, content vertically centred, max-width 460px): the step content.
   - Bottom: one row with two links, `Terms` to `/terms` and `Privacy` to `/privacy` (16px, weight 600, `var(--harbour)`, underlined, 24px apart). No other text there.
3. Step `start` (both adapter modes): `<h1 className={styles.punch}>Health cover, finally clear.</h1>`, then the sign-in block 36px below. No sub line, no "Private beta", no "Welcome to Knowvia".
   - Backend mode: `<AccessCard />`, then `DemoCard` under its existing condition.
   - Mock mode: the existing form (Google, Apple, the phone and email tabs, field, error, submit) with its `h1` and sub line removed.
4. `AccessCard`: no card border, background or shadow (it sits straight on the page). Removed: the title `Get access in 10 seconds`, the trial note paragraph and its comment, the `Privacy` note link. Order: Google link or button (when shown today) with text `Continue with Google`; the `or` divider (text `or`, 16px, weight 600); `Your name` field; `Email` field; password field under today's condition; submit button text `Sign in` (busy `Signing you in…`); the error line. The `done` card keeps its texts except `Access is open on this device. First step: add one policy. It takes about a minute.` becomes `Next, add your policy.`; the auto card says `Signing you in…` only. `aria-label` of the form becomes `Sign in`.
5. Other steps (`otp`, `mail`, `done`) keep their content and texts; their `h1` uses `styles.h1` (Newsreader, 44px, weight 500).
6. Right `<div className={styles.photo} aria-hidden="true">`: margin 16px, radius 28px, `overflow: hidden`, `position: relative`; inside it `<Image src="/opening/family.jpg" alt="" fill priority sizes="50vw" />` from `next/image` with `object-fit: cover; object-position: 42% 40%`. Nothing is drawn over the photograph: no caption, text, badge or gradient.
7. Under `@media (max-width: 900px)`: one column, the photograph is not shown (`display: none`), left padding 24px, the page may scroll.

## R6a.3 Styles

Both CSS files: theme tokens only (no hex colours), no shadows, gradients, blur or `@keyframes`; sizes in px; no font size under 16px; no font weight under 500.

- `.punch`: Newsreader (`var(--font-serif)`), 72px, line-height 1.02, weight 500, colour `var(--ink)`, `letter-spacing: -0.02em`, max-width 9ch. Under `@media (max-height: 760px)`: 52px.
- Fields: label 16px weight 600 above the input; input height 56px, 1.5px border `var(--field-border)`, radius 14px, background `var(--sheet)`, 18px weight 500; focus: 2px outline `var(--harbour)`.
- Google and other provider buttons: height 56px, full width, 1.5px border `var(--ink)`, radius 14px, background `var(--sheet)`, 18px weight 600, logo 24px.
- Submit (`Sign in`, `Send code`, `Verify`, links styled as buttons): height 56px, full width, radius 14px, background `var(--tide)`, colour `var(--on-harbour)`, 18px weight 600; hover background `var(--harbour)`; press `transform: scale(0.985)` over 90ms; disabled opacity 0.6.
- Errors: 16px weight 600, `var(--bad)`.
- Gaps inside the sign-in block: 16px. Under `@media (max-height: 760px)`: fields and buttons 48px high, gaps 12px, left padding 24px 48px.

## R6a.4 Harness: `e2e/real-opening.spec.ts`

Server as the other real specs (backend adapter mode, port from `KV_E2E_PORT`). No session cookie is set; `asRealAccount` is not used. Requests to other hosts are aborted as in `e2e/real-account.ts`. Helpers from `./real-calm`. Titles:

1. `the opening page shows the punch line, the sign-in form and the photograph`: at `/signin`, the `h1` is `Health cover, finally clear.`, has at most five words, the fields `Your name` and `Email` and the button `Sign in` are visible, the image `family.jpg` has loaded (`naturalWidth > 0`) and its box starts in the right half of the viewport.
2. `the opening page is calm at every laptop size`: `expectCalm` at every entry of `SIZES`, with `shot(page, "opening")`.
3. `the root path shows the same opening page`: `/` has the same `h1` and the `Sign in` button.
4. `no beta, trial or showcase text is on the opening page`: the page text has none of `Private beta`, `Trial`, `Get access`, `What you’ll see`, `Beta`.

All pass with zero findings; every other real spec still passes.

## R6a.5 Unit tests: `tests/components/kv-opening.test.tsx`

1. `the punch line is the only heading on the start step and has at most five words`
2. `the start step has no journey list, whys row, showcase or theme toggle`
3. `terms and privacy links sit in the footer row`
4. `the access form has name, email and a Sign in button, with no title or trial note`
5. `the photograph is decorative and has no caption`
6. `the home route renders the same opening page`

## R6a.6 Out of scope

Deleting `Landing.tsx`, `Tour.tsx` or mock data. Phone OTP on the real backend. Welcome steps. Any signed-in screen. New dependencies.
