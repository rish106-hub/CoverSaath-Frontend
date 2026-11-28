# Flat redesign spec (Phase 1)

Owner-approved design: canvas Version 6, source in `design/canvas-v6/` (prototype only; `flat.css` and `screens-w.js` are the latest layers). This spec is the contract for builders and eval authors.

## Rules (apply to every signed-in screen, sign-in and welcome)

1. Flat landing palette, light only. No blur, gradients, shadows or glass.
2. Signal colours: green fine, yellow needs you or still running, orange coming up, red problem or you pay. Prefer a coloured dot or coloured value over tag text.
3. Text floor: nothing under 16px. Small text is 16px at weight 600; body is 18px at weight 500. No weight under 500.
4. No disclaimers, "safe" lines, "Soon" labels, demo or trial labels. Legal text only on Terms and Privacy.
5. Symmetric strict grid, equal columns, one gap value per page. Each screen fits 1440x900 without scrolling; long lists are capped, tabbed or paged.
6. One main action per screen, as an obvious filled button. Secondary actions are outlined.
7. Motion is feedback only: press, busy, success, failure, number roll, row in and out. Reduced motion keeps feedback as fades.
8. Laptop and desktop only. Under 1024px wide: one "Open Knowvia on a laptop" screen.
9. The public landing page `/` (`src/app/page.tsx`, `components/public/Landing.tsx`) must not change visually. It keeps the existing global tokens and fonts.

## R1 Foundation: scoped theme and primitives

The existing global tokens in `src/styles/tokens.css` stay as they are (the landing page and `tests/styles/tokens.test.ts` depend on them). The new look is a scoped layer.

### R1.1 Scoped theme file `src/styles/app-theme.css`, imported last in `src/styles/globals.css`

Selector: `html:has(.kv-app), .kv-app` (both, so portals under `<body>` get the theme and browsers without `:has` still theme the subtree). The same declarations must also win when `data-theme="dark"` is set on `<html>`: add `html[data-theme="dark"]:has(.kv-app), [data-theme="dark"] .kv-app` to the selector list.

Declarations (exact values):

| Token | Value |
|---|---|
| `color-scheme` | `light` |
| `--paper` | `#f3f7f6` |
| `--sheet` | `#ffffff` |
| `--sunken` | `#e6efec` |
| `--ink` | `#1a3034` |
| `--graphite` | `#33494d` |
| `--muted` | `#55696d` |
| `--line` | `#cfdcda` |
| `--field-border` | `#7b918e` |
| `--harbour` | `#176f69` |
| `--on-harbour` | `#ffffff` |
| `--sea-glass` | `#a8dccb` |
| `--mist` | `#e3f0ee` |
| `--marker` | `#f6d38a` |
| `--ochre` | `#e0a02b` |
| `--signal` | `#e2702a` |
| `--signal-ink` | `#c8372d` |
| `--signal-bg` | `#fbe4e1` |
| `--g-cover`, `--g-family`, `--g-money`, `--g-help` | `#163f42` |
| `--g-cover-bg`, `--g-family-bg`, `--g-money-bg`, `--g-help-bg` | `#e3f0ee` |
| `--on-g` | `#ffffff` |
| `--panel-inverse-bg` | `#163f42` |
| `--panel-inverse-edge` | `#163f42` |
| `--ink-fixed` | `#1a3034` |
| `--paper-fixed` | `#f3f7f6` |
| `--harbour-fixed` | `#176f69` |
| `--tide` | `#163f42` |
| `--forest` | `#0f4a3a` |
| `--lime` | `#c8e6a0` |
| `--mint` | `#a8dccb` |
| `--fog` | `#cfdcda` |
| `--gold-tint` | `#fbf1dd` |
| `--ok` | `#2f9e5b` |
| `--warn` | `#e0a02b` |
| `--orange` | `#e2702a` |
| `--bad` | `#c8372d` |
| `--fs-11`, `--fs-12`, `--fs-13`, `--fs-14`, `--fs-15` | `16px` |
| `--fs-16`, `--fs-17` | `18px` |
| `--shadow-sm`, `--shadow-md`, `--shadow-lg` | `0 0 0 transparent` |
| `--t-in` | `150ms` |
| `--t-out` | `120ms` |
| `--t-press` | `90ms` |
| `--t-panel` | `200ms` |
| `--t-slide` | `240ms` |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--ease-enter` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--font-sans` | `var(--font-source-sans), system-ui, sans-serif` |

Plus one rule: `.kv-app { background: var(--paper); color: var(--ink); font-family: var(--font-sans); font-size: 18px; font-weight: 500; min-height: 100vh; }`.

### R1.2 Fonts in `src/app/layout.tsx`

Add `Source_Sans_3` from `next/font/google` with `variable: "--font-source-sans"`, weights `["500", "600", "700"]`, `display: "swap"`, and add its variable class to `<html>`. Change `Newsreader` weights to `["400", "500", "600"]`. Geist and Geist Mono stay (the landing page uses them).

### R1.3 Apply the scope in `src/app/(app)/layout.tsx`

Wrap `<AppShell>` in `<div className="kv-app">`.

### R1.4 Primitives in `src/components/ui/`, styles in one new file `src/components/ui/kv.module.css`, exported from `src/components/ui/index.ts`

All are client components unless they have no state. No new dependencies. Every interactive primitive has a visible `:focus-visible` outline (2px `--harbour`, offset 3px) and a press state (`transform: translateY(1px) scale(0.98)` over `--t-press`). No box-shadow and no gradient anywhere in `kv.module.css`. No font-size under 16px and no font-weight under 500 in `kv.module.css`.

| Component | Props | Behaviour |
|---|---|---|
| `Button` | `variant?: "primary" \| "outline" \| "quiet"` (default primary), `size?: "md" \| "lg"`, `state?: "idle" \| "busy" \| "done"`, `busyLabel?: string`, `doneLabel?: string`, `arrow?: boolean`, plus native button props | Primary: background `--forest`, text white, hover `--harbour`. Outline: 2px `--ink` inset border on `--sheet`. Quiet: `--mist` background, `--harbour` text. `state="busy"`: `disabled`, `aria-busy="true"`, shows `busyLabel`, and a spinner element (`data-spinner`) that is rendered only after 250ms. `state="done"`: `disabled`, shows a tick svg (`data-tick`) and `doneLabel`. `arrow` appends "→" (hidden when busy or done). Min height 50px (`lg`: 60px). |
| `Signal` | `kind: "ok" \| "warn" \| "orange" \| "bad"`, `variant?: "dot" \| "pill"` (default dot), `children` | Dot: a 12px circle in the kind colour, `aria-hidden`, followed by the children as normal text. Pill: tinted background (kind colour at 20% over white), 16px weight 700 text in `--ink`, leading dot. Root carries `data-kind`. |
| `Field` | `label: string`, `error?: string`, `children` (one input) | `<label>` wrapping a label span and the control; when `error` is set renders it in a `role="alert"` element in `--bad` and sets `data-invalid` on the root. |
| `Segmented` | `options: string[]`, `value: string`, `onChange(v)`, `label: string` | `role="group"` with `aria-label`; one button per option with `aria-pressed`; selected is `--tide` background, white text. |
| `Switch` | `checked`, `onChange(checked)`, `label: string` | `<button role="switch" aria-checked>` with accessible name `label`; on colour `--ok`. |
| `Card` | `as?: "div" \| "a" \| "button"`, `tone?: "plain" \| "next" \| "inverse"`, native props | Flat `--sheet` background, 1.5px `--line` border, radius 22px, padding 28px. `next`: `--gold-tint` background and `--warn` border. `inverse`: `--tide` background, white text, no border. Clickable variants (`a`, `button`) get hover border `--harbour` and background `--mist`. |
| `Ring` | `value: number` (0 to 100), `label: string`, `kind?: Signal kind` | SVG circle progress, 112px; stroke colour from `kind`, default `ok` when value is 100 else `warn`; `role="img"` with `aria-label` of `label`; centre text shows `label`. |
| `Bar` | `value: number` (0 to 1), `kind?: Signal kind`, `label: string` | `role="progressbar"` with `aria-valuenow` 0 to 100 and `aria-label`; fill animates with `transform: scaleX`. |
| `InlineStatus` | `kind: "idle" \| "busy" \| "ok" \| "error"`, `children` | Always renders its container so the live region exists before content changes. `error` uses `role="alert"` and `--bad`; other kinds use `role="status"`; `ok` shows a tick. |
| `Tabs` | `tabs: { id: string; label: string }[]`, `value`, `onChange(id)`, `label: string` | `role="tablist"` with `aria-label`; buttons `role="tab"` with `aria-selected`; Left and Right arrow keys move selection. |

### R1.5 Out of scope for R1

Deleting old components, touching any screen, the shell, the landing page, `tokens.css`, dark theme code, tests other than the new ones, dependencies.

## R2 Shell: side rail, sub-tabs, ask bar, laptop gate

Applies to every page under `src/app/(app)/`, for demo and real audiences alike. `GroupId`, `GROUPS` and `PAGES` in `src/lib/ia.ts` are closed registries used by voice navigation, return paths and page context: R2 adds to `ia.ts`, it removes and renames nothing there.

### R2.1 `src/lib/ia.ts` additions

```ts
export type RailId = "home" | "policies" | "ask" | "family" | "money";
export type RailPlace = { id: RailId; label: string; href: string; tabs: { route: string; label: string }[] };
export const RAIL: readonly RailPlace[] = [
  { id: "home", label: "Home", href: "/home", tabs: [] },
  { id: "policies", label: "My policies", href: "/policies", tabs: [
    { route: "/policies", label: "All policies" }, { route: "/compare", label: "Compare" },
    { route: "/stress-test", label: "Stress test" }, { route: "/hospitals", label: "Hospitals" } ] },
  { id: "ask", label: "Ask", href: "/chat", tabs: [] },
  { id: "family", label: "Family", href: "/family", tabs: [
    { route: "/family", label: "People" }, { route: "/family/memory", label: "Cover memory" },
    { route: "/covers/declarations", label: "Health details" } ] },
  { id: "money", label: "Money", href: "/money", tabs: [
    { route: "/money", label: "Premiums" }, { route: "/tools", label: "Calculators" } ] },
];
export function railFor(pathname: string): RailPlace | undefined
```

`railFor` strips a trailing slash, then returns the place whose `href` equals the path or one of whose `tabs[].route` equals the path; any path starting with `/policies/` or `/covers/` (other than `/covers/declarations`) returns the `policies` place; everything else (`/emergency`, `/settings`, `/profile`, unknown) returns `undefined`.

### R2.2 `AppSidebar`

Markup order inside `<aside id="app-sidebar" aria-label="Knowvia">`: brand mark; a link "Add a policy" to `/covers/add` (`data-testid="rail-add"`); `<nav aria-label="Knowvia sections">` with one link per `RAIL` place, text = `label`, `aria-current="page"` on the place returned by `railFor(pathname)`; then a bottom block with a link "Emergency" (target `navHref` of the `/emergency` page for the audience, `aria-current` on `/emergency`), a link "Settings" to `/settings` (`aria-current` on `/settings`) and `<UserChip />`.

Removed from the sidebar: group headings and collapse buttons, `GroupIcon`, the "Today" and "Reading list" blocks, the mobile top bar, menu button, scrim and drawer logic. `NAV_CLOSED_KEY` stays exported (unused).

Style (`AppSidebar.module.css` rewritten): background `--tide`, text white, width 236px, radius 26px, margin 14px 0 14px 14px, rail links 46px high at 19px weight 600, current link colour `--lime` with a 3px `--lime` bar on its left, "Add a policy" is a `--lime` filled button with `--tide` text, Emergency text colour `#ffb4a6` is the single literal colour allowed in this file.

### R2.3 `PageHeader`

Renders `<nav aria-label={place.label} data-testid="page-subtabs">` with one link per tab of `railFor(pathname)` when that place has tabs; the current tab (`route === pathname`, or `/policies` for any `/policies/...` path) has `aria-current="page"`. Renders nothing when there is no place or the place has no tabs. The breadcrumb (`data-testid="page-breadcrumb"`) is removed. Tab style: pills 42px high, 17px weight 600, current pill `--tide` background with white text.

### R2.4 `AppShell`

- Top bar: `<PageHeader>` on the left (also on `/home`, where it renders nothing), on the right `<HeaderMic />` and a button "Search or jump to" with a `<kbd>⌘K</kbd>` that opens the command palette through the same `useAgent()` action the existing shortcut uses.
- `ThemeButton` and `TrialNotice` are no longer rendered by the shell.
- Below `<main>`: `<AskBar />`.
- A sibling `<ViewportGate />` and CSS so that under 1024px wide the shell is `display: none` and the gate is shown; at 1024px and wider the gate is `display: none`. Media queries only, no JavaScript.
- Layout: the shell is a two-column grid (`236px + 14px` rail column, then the main column), `height: 100dvh`, no page-level scroll; `<main>` is the only scrolling element (`overflow-y: auto`) and has padding `8px 40px 20px 34px`.
- The `dock` prop and `.dock` slot are removed.

### R2.5 New `src/components/agent/AskBar.tsx` (+ `AskBar.module.css`)

A `<form role="search" aria-label="Ask about your cover">` with a text input (placeholder "Ask about your cover", `aria-label` same) and a primary `Button` "Ask" with `arrow`. Submitting an empty value focuses the input and does nothing else. Submitting text navigates with `router.push("/chat?q=" + encodeURIComponent(text))` and clears the input. Renders nothing when the pathname starts with `/chat` or equals `/emergency`. `AgentLayer` no longer renders `AskDock` (the `VoiceCoach` line stays); `AskDock.tsx` itself is not deleted.

### R2.6 New `src/components/shell/ViewportGate.tsx`

`<div data-testid="viewport-gate">` with the brand mark, an `<h1>` "Open Knowvia on a laptop." and a paragraph "Sign in there with the same account. Your cover is waiting." Exported from `src/components/shell/index.ts`.

### R2.7 `CommandPalette`

Page entries skip `demoOnly` pages unless `useNavAudience()` is `"demo"`. The "Switch light and dark" action is removed.

### R2.8 Copy in shell states

| File | Title | Body |
|---|---|---|
| `shell/BackendDown.tsx` | Knowvia is not answering. | This page will load when the service is back. |
| `shell/ErrorPanel.tsx` (default title) | This page did not load. | The rest of Knowvia is working. |
| `shell/EmptyState.tsx` unreachable state | Knowvia is not answering. | This page will load when the service is back. |
| `shell/EmptyState.tsx` account-has-a-policy state | Your policy is on Knowvia. | (no second line) |
| `src/app/global-error.tsx` | This page did not load. | Try again in a moment. |

Button labels stay as they are. No string in these files contains "safe" or "coming soon".

### R2.9 Tests

Every test file that imports a changed module is run and brought in line with this spec. A test may be deleted only when its whole subject was removed from the shell by R2 (trial notice in the shell, theme button in the shell, breadcrumb, group collapse, mobile drawer); otherwise its assertions are updated. New test file `tests/components/kv-shell.test.tsx` covers R2.1 to R2.8.

### R2.10 Out of scope for R2

Screens inside `<main>`, the add-a-policy wizard layout, sign-in, welcome, the landing page, `ThemeProvider` itself, `SettingsView`, deleting `AskDock`, `TrialNotice` or `DemoBadge` files, Playwright specs, dependencies.

## R3c Payment flow (no screen)

Scope: the money path behind "Pay Rs 199", with no screen in it. The wizard (R3b) renders from the interface pinned here. Price, order creation and signature checks stay on the backend; nothing here decides that a payment succeeded.

Persona served: a 25 to 35 year old tech worker adding a second policy, paying Rs 199 by card or UPI QR on a laptop. They must never be asked to pay twice for one policy and must never see provider text.

### R3c.1 Files

| File | Change |
|---|---|
| `src/adapters/types.ts` | `AdapterError` gets an optional third constructor parameter. |
| `src/lib/razorpay.ts` | Closed failure-reason set, late settlement, no provider text kept. |
| `src/components/covers/pay-flow.ts` | New. The pay sequence and its copy. |
| `tests/lib/razorpay.test.ts` | New. |
| `tests/components/pay-flow.test.ts` | New. |

No other file changes. `AddCoverView.tsx`, `documents-contract.ts` (`ERROR_TEXT`), `adapters/payments.ts` and the BFF routes under `src/app/api/app/payments/` are not edited.

### R3c.2 `AdapterError`

```ts
export class AdapterError extends Error {
  constructor(public code: string, public retryable = false, public reason: string | null = null) {
    super(code);
    this.name = "AdapterError";
  }
}
```

`reason` is only ever a member of a closed set chosen by our code. It never holds text from a provider or the backend.

### R3c.3 `src/lib/razorpay.ts`

Exports added:

```ts
export const PAY_FAIL_REASONS = ["declined", "insufficient_funds", "timed_out", "authentication", "bank_unavailable", "other"] as const;
export type PayFailReason = (typeof PAY_FAIL_REASONS)[number];
export function reasonOf(raw: unknown): PayFailReason
```

`reasonOf` takes the value passed to the `payment.failed` callback. It reads `raw.error.reason` only when that is a string, lower-cases it, and returns the first match in this order:

| Contains | Result |
|---|---|
| `insufficient` | `insufficient_funds` |
| `timed_out`, `timeout` or `expired` | `timed_out` |
| `otp`, `pin`, `auth` or `3ds` | `authentication` |
| `declin`, `risk`, `blocked` or `not_allowed` | `declined` |
| `bank`, `gateway`, `server` or `technical` | `bank_unavailable` |
| anything else, missing, or not a string | `other` |

`error.description`, `error.code`, `error.source`, `error.step` and `error.metadata` are never read, stored, logged or returned.

Settlement rule in `payWithRazorpay` (signature unchanged: `(order, prefill?) => Promise<PaymentProof>`):

- `payment.failed` does not settle the promise. It stores `lastReason = reasonOf(r)` and nothing else. The Razorpay window stays open and the person can retry inside it.
- `handler` resolves with the three ids (as today) and marks settled.
- `modal.ondismiss`, when not settled: rejects with `new AdapterError("PAYMENT_FAILED", true, lastReason)` if a failure was stored, otherwise `new AdapterError("PAYMENT_CANCELLED")`.
- A `handler` call after one or more `payment.failed` calls resolves normally (failed then paid in the same window).
- The options object passed to Razorpay keeps today's keys and adds `retry: { enabled: true }`. `description` stays "Add another policy". No other option is added.
- Script loading (`load()`) is unchanged.

### R3c.4 `src/components/covers/pay-flow.ts`

```ts
import type { PaymentOrder, PaymentProof, PolicySlots } from "@/adapters/payments";
import type { PayFailReason } from "@/lib/razorpay";

export type PayDeps = {
  order(): Promise<PaymentOrder>;
  open(order: PaymentOrder): Promise<PaymentProof>;
  verify(proof: PaymentProof): Promise<PolicySlots>;
  slots(): Promise<PolicySlots>;
  /** Waits this many milliseconds. Tests pass a no-op. */
  wait(ms: number): Promise<void>;
};

export type PayState =
  | { kind: "idle" }
  | { kind: "opening" }
  | { kind: "confirming" }
  | { kind: "paid"; slots: PolicySlots }
  | { kind: "stopped"; code: string; reason: PayFailReason | null; canPayAgain: boolean; proof: PaymentProof | null };

export const VERIFY_TRIES = 3;
export const VERIFY_WAIT_MS = 2000;
export const SLOT_TRIES = 3;
export const SLOT_WAIT_MS = 3000;

export function realPayDeps(): PayDeps
export async function runPay(deps: PayDeps, onState: (s: PayState) => void): Promise<PayState>
export async function confirmPay(deps: PayDeps, proof: PaymentProof, onState: (s: PayState) => void): Promise<PayState>
export function payCopy(state: PayState): string
```

`realPayDeps()` returns `{ order: payments.order, open: (o) => payWithRazorpay(o), verify: payments.verify, slots: payments.slots, wait: (ms) => new Promise((r) => setTimeout(r, ms)) }`.

Neither function throws. Each returns the last state it passed to `onState`.

`runPay`:

1. `onState({ kind: "opening" })`. Call `deps.order()`.
   - Rejects with code `POLICY_SLOT_AVAILABLE`: call `deps.slots()`; if it resolves with `canAdd === true` the result is `{ kind: "paid", slots }`. If it rejects or `canAdd` is false the result is `stopped` with code `POLICY_SLOT_AVAILABLE`, `canPayAgain: true`, `proof: null`.
   - Rejects with any other code: `stopped`, that code, `reason: null`, `proof: null`, `canPayAgain` false for `PAYMENTS_DISABLED`, `PAYMENTS_NOT_CONFIGURED` and `UNAUTHENTICATED`, true otherwise.
2. Call `deps.open(order)`. A rejection gives `stopped` with the error's code, `reason` (the error's `reason` when it is a member of `PAY_FAIL_REASONS`, else null), `proof: null`, `canPayAgain: true`.
3. With a proof in hand, return `confirmPay(deps, proof, onState)`.

`confirmPay`:

1. `onState({ kind: "confirming" })`.
2. Call `deps.verify(proof)` up to `VERIFY_TRIES` times. Resolve: result `{ kind: "paid", slots }`. A rejection whose error has `retryable === true`, or whose code is `BACKEND_UNREACHABLE`, `BACKEND_TIMEOUT` or `BACKEND_BUSY`: `await deps.wait(VERIFY_WAIT_MS)` and try again while tries remain. Any other rejection stops the verify loop at once. Remember the last code.
3. Verify did not resolve: call `deps.slots()` up to `SLOT_TRIES` times, with `await deps.wait(SLOT_WAIT_MS)` before the second and third call. The first resolve with `canAdd === true` gives `{ kind: "paid", slots }` (the backend confirmed it another way). A rejection counts as a try.
4. Still not paid: `stopped` with `code: "PAYMENT_UNCONFIRMED"`, `reason: null`, `canPayAgain: false`, `proof` (the same proof, so "Check again" can call `confirmPay` with it). If the last verify code was `UNAUTHENTICATED`, the code is `UNAUTHENTICATED` instead, still with `canPayAgain: false` and the proof.

Once a proof exists, no state ever has `canPayAgain: true`.

Non-error codes are read with `e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE"`.

`payCopy(state)` returns exactly:

| State | Text |
|---|---|
| `idle` | `""` |
| `opening` | `Opening the payment window` |
| `confirming` | `Confirming your payment` |
| `paid` | `Paid. You can add your policy now.` |
| `stopped`, `PAYMENT_CANCELLED` | `You closed the payment window. Nothing was paid.` |
| `stopped`, `PAYMENT_FAILED`, reason `declined` | `Your bank declined this payment. Try another card or UPI.` |
| `stopped`, `PAYMENT_FAILED`, reason `insufficient_funds` | `There was not enough balance. Try another card or UPI.` |
| `stopped`, `PAYMENT_FAILED`, reason `timed_out` | `The payment timed out. Try again.` |
| `stopped`, `PAYMENT_FAILED`, reason `authentication` | `Your bank could not verify you. Check the OTP or PIN and try again.` |
| `stopped`, `PAYMENT_FAILED`, reason `bank_unavailable` | `Your bank did not answer. Try again in a minute.` |
| `stopped`, `PAYMENT_FAILED`, reason `other` or null | `The payment did not go through. Try again.` |
| `stopped`, `PAYMENT_UNCONFIRMED` | `We are still confirming your payment. This can take a minute. Do not pay again.` |
| `stopped`, `PAYMENTS_DISABLED` or `PAYMENTS_NOT_CONFIGURED` | `Adding another policy is not open yet.` |
| `stopped`, `UNAUTHENTICATED` | `Please sign in again.` |
| `stopped`, any other code | `We could not open the payment window. Try again.` |

The file carries the comment `// FOR LEGAL REVIEW: price and payment wording.` above the copy.

### R3c.5 Tests

`tests/lib/razorpay.test.ts` (window.Razorpay replaced by a fake constructor that records options and exposes the callbacks), titles:

1. `reasonOf maps each known family and falls back to other`
2. `reasonOf ignores description, code and non-string reasons`
3. `resolves with the three ids when the handler fires`
4. `a failure does not settle; closing the window after it rejects PAYMENT_FAILED with the reason`
5. `a failure followed by a success in the same window resolves with the proof`
6. `closing the window with no failure rejects PAYMENT_CANCELLED`
7. `the rejected error carries no provider text`
8. `passes retry enabled and the order fields to Razorpay`

`tests/components/pay-flow.test.ts` (fake deps, `wait` a no-op spy), titles:

1. `happy path goes opening, confirming, paid`
2. `order refused with PAYMENTS_DISABLED stops and cannot pay again`
3. `order refused with POLICY_SLOT_AVAILABLE re-reads slots and reports paid`
4. `a closed window stops with PAYMENT_CANCELLED and can pay again`
5. `a failed payment keeps its reason and can pay again`
6. `verify retries a retryable failure and then reports paid`
7. `verify failing three times falls back to slots and reports paid when a slot is free`
8. `verify and slots both failing stops as PAYMENT_UNCONFIRMED, keeps the proof and cannot pay again`
9. `a non-retryable verify refusal skips further verify tries and still re-reads slots`
10. `confirmPay with a kept proof can reach paid without opening the window again`
11. `no state after a proof exists has canPayAgain true`
12. `payCopy returns the pinned text for every row`
13. `runPay and confirmPay never throw`

### R3c.6 Out of scope

Any screen or CSS. `AddCoverView.tsx`. `ERROR_TEXT` and its `PAYMENT_SIGNATURE_INVALID` line (owner decision pending on its wording). BFF routes, backend, webhook. Hiding UPI Collect. New dependencies.

## R3b Add-a-policy wizard

Scope: `/covers/add` becomes a one-screen-per-step wizard with no side rail, top bar or ask bar. The route, its URL, `?resume=1`, the upload sequence in `add-cover-flow.ts` and every backend call stay as they are. Canvas reference: `design/canvas-v6/screens-w.js`.

Persona served: a 25 to 35 year old tech worker adding a first or second health policy from a PDF on a laptop. They see one question per screen, one main action, plain words while the file is read, and a way to fix every failure. They never see an error code or backend text.

### R3b.1 Files

| File | Change |
|---|---|
| `src/components/shell/AppShell.tsx` | Bare mode for `/covers/add` (R3b.2). |
| `src/components/shell/AppShell.module.css` | `.bare` rule (R3b.2). |
| `src/components/covers/AddCoverView.tsx` | Rewritten as the wizard. Export name and props unchanged. |
| `src/components/covers/wizard-copy.ts` | New. Step labels, stage copy, `screenOf`, `guideFor`. No JSX. |
| `src/components/covers/PeopleStep.tsx` | New. The "Who is in your family?" screen. |
| `src/components/covers/wizard.module.css` | New. All wizard styles. |
| `tests/components/kv-wizard.test.tsx` | New (R3b.9). |
| `tests/components/add-cover-view.test.tsx`, `add-cover-resume.test.tsx`, `consent-upload-states.test.tsx` | Selectors and copy updated per R3b.10. Every `it` title is kept. |
| `e2e/add-cover.ts`, `e2e/journey.spec.ts` | Only the lines that tick the consent checkbox, press "Continue" on consent, press "Choose the schedule PDF", or expect the three done links, updated to the new names. Playwright is not run in this task. |

Not edited: `add-cover-flow.ts`, `pay-flow.ts`, `lib/razorpay.ts`, `adapters/*`, `documents-contract.ts`, `covers.module.css`, `CoverReviewView.tsx`, `DeclarationsView.tsx`, `src/lib/ia.ts`, any file under `src/app/`.

### R3b.2 Bare shell

In `AppShell`, after `pathname` is computed: `const bare = pathname === "/covers/add";`. The signed-out redirect effect is unchanged and runs in both modes. When `bare` is true the component returns:

```tsx
<AgentProvider>
  <div className={styles.bare} data-shell="bare">
    <main id="main-content" tabIndex={-1}>{children}</main>
  </div>
  <div className={styles.gateWrap}><ViewportGate /></div>
</AgentProvider>
```

No `AppSidebar`, `TopBar`, `AskBar`, `AgentLayer` or skip link in bare mode. CSS: `.bare { height: 100dvh; overflow: hidden; }` and, inside the existing `@media (max-width: 1023px)` block, `.bare { display: none; }`. Every other path renders exactly as before.

### R3b.3 Screens

`wizard-copy.ts` exports:

```ts
export const WIZARD_STEPS = ["Find your policy", "Reading it", "Your people", "Your cover"] as const;
export type WizardScreen = "loading" | "load-failed" | "consent" | "pay" | "find" | "reading" | "guide" | "plan" | "plan-retry" | "people" | "cover";
export type ScreenInput = {
  consent: boolean | null; loadFailed: boolean; done: boolean; peopleDone: boolean; hasCandidates: boolean;
  slotStatus: "empty" | "working" | "waiting" | "failed" | "done"; slotCode: string | null; mustPay: boolean; hasHolding: boolean;
};
export function screenOf(i: ScreenInput): WizardScreen
export function stepOf(screen: WizardScreen): 1 | 2 | 3 | 4
```

`screenOf` returns the first match, in this order:

1. `consent === null && !loadFailed` : `loading`
2. `consent === null && loadFailed` : `load-failed`
3. `done && peopleDone` : `cover`
4. `done` : `people`
5. `hasCandidates` : `plan`
6. `consent === false` : `consent`
7. `slotStatus` is `working` or `waiting` : `reading`
8. `slotStatus === "failed"` and `slotCode` is neither `PAYMENT_REQUIRED` nor `CONSENT_REQUIRED` : `guide`
9. `mustPay` : `pay`
10. `slotStatus === "done" && hasHolding` : `plan-retry`
11. otherwise : `find`

`stepOf`: `loading`, `load-failed`, `consent`, `pay`, `find` give 1; `reading`, `guide`, `plan`, `plan-retry` give 2; `people` gives 3; `cover` gives 4.

`AddCoverView` renders exactly one screen, the one `screenOf` returns. `mustPay` keeps today's formula (`!resumed && ((slots !== null && slots.enabled && !slots.canAdd) || schedule.code === "PAYMENT_REQUIRED")`).

### R3b.4 Frame (every screen)

Root: `<div className={s.frame} data-screen={screen}>` with three rows, `height: 100dvh`, `grid-template-rows: 72px minmax(0, 1fr) 88px`, background `var(--paper)`, no scroll (`overflow: hidden`).

- Top row: left `BrandMark` (size 28) and the word "Knowvia"; centre `<ol aria-label="Steps">` with the four `WIZARD_STEPS`, each `<li>` showing its number and label, the current one with `aria-current="step"`, earlier ones with `data-done="true"`; right `<Link href="/home">Close</Link>` styled as an outline button.
- Middle row: one centred column, `max-width: 760px`, content vertically centred, `gap: 20px`. The screen heading is the only `<h1>`: Newsreader, 44px, line-height 1.1, weight 500. All other text is 18px weight 500 or 16px weight 600. Nothing under 16px, no weight under 500.
- Bottom row: `padding: 0 40px`, secondary action on the left, main action on the right (`justify-content: space-between`). A screen with one action puts it on the right.

Buttons are the shared `Button` (R1). Main actions use `variant="primary" size="lg"`; secondary use `variant="outline" size="lg"`. Links that look like buttons use `.linkPrimary` and `.linkOutline` in `wizard.module.css`, matching the `lg` button box (height, radius, weight, colours). Colours come from the app theme tokens only; no hex values, shadows, gradients or blur in `wizard.module.css`. Motion: only `transition` on `opacity`, `transform`, `border-color`, `background-color` using `var(--t-in)`, `var(--t-out)`, `var(--t-press)`; no `@keyframes` except one `kvWizardPulse` opacity pulse for the active reading row, which is switched off under `@media (prefers-reduced-motion: reduce)`.

### R3b.5 Screen content

`{MB}` is `MAX_UPLOAD_BYTES / 1024 / 1024`. `{price}` is `(slots.pricePaise / 100).toLocaleString("en-IN")`.

**loading**: `<div role="status" aria-label="Loading your upload page"><PageSkeleton height={160} /></div>` (as today). No heading, empty bottom row.

**load-failed**: `<ErrorBox code={loadFailure} onRetry={retryLoad} />` (as today).

**consent** (keep the comment `// FOR LEGAL REVIEW: the wording below is not final.` above it):
- h1: `Can Knowvia read your policy?`
- A three-item list: `Keep it in your account, in encrypted storage.` / `Check it for harmful content.` / `Read its text and pull out the cover details, such as sum insured and waiting periods.`
- A link `Privacy` to `/privacy`.
- Main action: `Yes, read my policy` (busy label `Saving`). It calls `uploads.grantConsent(consentKey.current)` as today. No checkbox.
- After a successful grant, when `schedule.code === "CONSENT_REQUIRED"` and `schedule.file` is set, the held file is sent again at once through today's `retrySchedule` path (same slot, same request key). With no held file the screen becomes `find`.

**pay** (keep the comment `// FOR LEGAL REVIEW: price and payment wording.`; root of the middle column carries `data-testid="pay-card"`):
- h1: `Add another policy for Rs {price}.`
- Text: `Your first policy is free. Each one after that is Rs {price}, paid once.`
- State is a `PayState` from `pay-flow.ts`, starting `{ kind: "idle" }`. The main action runs `runPay(realPayDeps(), setPay)`.
- Main action label by state: `idle` `Pay Rs {price}`; `opening` busy with `payCopy(state)`; `confirming` busy with `payCopy(state)`; `stopped` with `canPayAgain` true `Pay Rs {price}`; `stopped` with a proof `Check again`, which runs `confirmPay(realPayDeps(), proof, setPay)`; `stopped` with `canPayAgain` false and no proof: no main action.
- `stopped`: `<InlineStatus kind="error">{payCopy(state)}</InlineStatus>` above the bottom row. Code `UNAUTHENTICATED` adds a `Sign in` link to `/signin`.
- `paid`: call `setSlots(state.slots)`. If `schedule.file` is set and `schedule.code === "PAYMENT_REQUIRED"`, send the held file at once (today's path in `pay()`, same request key). Otherwise reset the slot to `emptySlot()` when its code was `PAYMENT_REQUIRED`. The next screen (`find` or `reading`) shows `<InlineStatus kind="ok">Paid. You can add your policy now.</InlineStatus>` until a file is chosen or the reading ends.
- The old `pay()` function, `payWithRazorpay` import and "Opening payment..." label are removed from `AddCoverView.tsx`.

**find**:
- h1: `Drop your policy PDF here.`
- Text: `PDF, up to {MB} MB. The schedule page is enough: who is covered, the sum insured and the dates.`
- `<label>` `Type of policy` with the native `<select data-testid="policy-type">` (same options, same `disabled={typeLocked || schedule.status !== "empty"}`, default `personal_health`).
- The whole middle column is the drop target (today's `onDragOver`, `onDragLeave`, `onDrop`, `data-over`).
- Hidden file input unchanged: `aria-label="Policy schedule PDF"`, `data-testid="schedule-input"`, `accept="application/pdf,.pdf"`.
- Main action: `Choose PDF`, `data-slot="policy_schedule"`, disabled while busy or when no type is chosen. It opens the file input.

**reading** (`<div role="status" aria-live="polite" data-state="working" data-stage={stage}>`):
- h1: the current stage's heading from `STAGE_COPY`.
- `<Bar value={percent} label="Reading your policy" />` with the current stage's percent.
- An ordered list of all five stages, each row its `label`, with `data-step` `done`, `active` or `todo` (as today), a green `Signal` dot on done rows and ` (in progress)` in a visually hidden span on the active row.
- `STAGE_COPY` in `wizard-copy.ts`, keyed by stage:

| Stage | label | h1 | percent |
|---|---|---|---|
| `sending` | `Sending your PDF` | `Sending your PDF.` | 15 |
| `checking` | `Safety check` | `Checking the file is safe.` | 35 |
| `reading` | `Reading the pages` | `Reading the pages.` | 55 |
| `details` | `Pulling out cover details` | `Pulling out your cover details.` | 75 |
| `matching` | `Finding your plan` | `Finding your plan.` | 90 |

- The percent comes only from the stage. No timer changes it.
- When `schedule.status === "waiting"`: the text `Still working on it. A long policy can take a minute or two.` and a secondary action `Check again` (disabled while busy) that runs today's `checkAgain`. In addition the page checks by itself: while the screen is `reading`, the status is `waiting` and nothing is busy, a `setTimeout` of `POLL_MS = 5000` runs `checkAgain`; at most `POLL_MAX = 36` automatic checks per document; the timer is cleared on unmount and whenever the status leaves `waiting`. `POLL_MS` and `POLL_MAX` are exported from `wizard-copy.ts`.
- No main action. No Back.

**guide** (`<div role="alert" data-state="failed">`):
- `guideFor(code: string): { title: string; fix: string; action: "another" | "retry" | "policies" | "signin" | "later" }` from `wizard-copy.ts`. `{MB}` is filled by the caller.

| Codes | title | fix | action |
|---|---|---|---|
| `PDF_PROTECTED` | `This PDF has a password on it.` | `Open it, choose Print, then Save as PDF. Add the new copy.` | another |
| `PDF_ACTIVE_CONTENT`, `PDF_TOO_COMPLEX` | `This PDF needs a clean copy.` | `Open it, choose Print, then Save as PDF. Add the new copy.` | another |
| `FILE_TYPE_INVALID` | `That file is not a PDF.` | `Download the policy as a PDF from your insurer's email or app.` | another |
| `FILE_TOO_LARGE` | `That PDF is too big.` | `Add only the schedule pages: who is covered, the sum insured and the dates.` | another |
| `PDF_TOO_LONG` | `That PDF has too many pages.` | `Add only the schedule pages: who is covered, the sum insured and the dates.` | another |
| `FILE_EMPTY`, `PDF_UNREADABLE` | `We could not open this PDF.` | `Download a fresh copy from your insurer and add it.` | another |
| `DOCUMENT_REJECTED`, `POLICY_TYPE_INVALID` | `We could not accept this file.` | `Add another copy of the policy.` | another |
| `HOLDING_CREATE_FAILED`, `READING_FAILED` | `We could not read this one.` | `Add it again, or use the copy from your insurer's email.` | another |
| `DUPLICATE_DOCUMENT`, `HOLDING_DOCUMENT_HAS_HOLDING` | `This policy is already added.` | `Open it from My policies.` | policies |
| `READING_UNAVAILABLE`, `UPLOAD_UNAVAILABLE`, `HOLDINGS_DISABLED` | `Reading is paused right now.` | `Your file is saved. Come back in a little while.` | later |
| `UNAUTHENTICATED` | `Please sign in again.` | `Then add your policy.` | signin |
| any other code | `That did not go through.` | `Check your connection and try again.` | retry |

- h1: `title`. Text: `fix`. A line with the file name (`slot.file?.name`) when there is one.
- Actions: `another`: main `Choose another PDF` (opens the file input). `retry`: main `Try again` (today's `retrySchedule`) when `canRetry(schedule)` is true, and secondary `Choose another PDF`; when `canRetry` is false, main `Choose another PDF` only. `policies`: main link `Open my policies` to `/policies`. `signin`: main link `Sign in` to `/signin`. `later`: main link `Go to Home` to `/home`.
- The code itself and `errorText` are never rendered on this screen.

**plan**:
- h1: `Which plan is this?`
- With a top guess and the search closed: `We think this is {insurer} – {product}.` Otherwise `Tell us which plan this is.`
- Guesses: the first 3 candidates only (`cands.candidates.slice(0, 3)`), as radio rows inside `role="radiogroup" aria-label="Plan choices"`, product name bold and insurer name beside it (as today).
- No guesses: `We could not tell from the first pages. Search for it below.`
- Secondary action: `Something else` / `Back to our guesses` (today's toggle and `aria-expanded`).
- Search (open, or no guesses): field `Insurer or plan name` (maxLength 100, Enter searches), outline button `Search`, results capped at 4 (`slice(0, 4)`) in `role="radiogroup" aria-label="Search results"`, empty result text `Nothing matched. Try fewer words.` Plan names only; never a registry number.
- Main action: `Yes, it is {pick.label}`; with nothing picked, disabled with label `Choose a plan`; while confirming, busy with label `Checking your insurer's terms`. It runs today's `confirm()` (same request-key rule).
- Other failures on this screen (`error` state from search or confirm): `<InlineStatus kind="error">{errorText(error)}</InlineStatus>`; code `UNAUTHENTICATED` adds a `Sign in` link.

**plan-retry**: h1 `Finding your plan.`, `<InlineStatus kind="error">{errorText(error)}</InlineStatus>` when `error` is set, main action `Try again` running `loadCandidates(holdingId)`; code `UNAUTHENTICATED` shows a `Sign in` link instead of the button.

**people** (`PeopleStep`, props `{ onDone: () => void }`):
- h1: `Who is in your family?`
- On mount: `adapters.members.list()`. Rows show people who are neither `isOwner` nor `isYou`: name, and relation when set. At most 4 rows; more than 4 adds the line `and {n} more`.
- List failed: `<InlineStatus kind="error">We could not load your family. Add people later from Family.</InlineStatus>`; the form and actions still work.
- Form: `Field` `Name` (text input, maxLength 80) and `Field` `Relation` (native select: `Spouse`, `Son`, `Daughter`, `Father`, `Mother`, `Other`; value equals the label; default `Spouse`). Outline button `Add person` (busy label `Adding`), disabled when the trimmed name is empty. It calls `adapters.members.add({ name: name.trim(), relation })`, appends the result to the list and clears the name. Failure: `<InlineStatus kind="error">We could not save that. Try again.</InlineStatus>`, the typed name is kept.
- Actions: secondary `Skip for now`, main `Continue`. Both call `onDone`. Nothing is linked to the policy (the backend has household members only).

**cover**:
- h1: `{pick.label} is in.`
- `<div role="status">` with the text `Your cover is saved.`
- Main link `Open my policy` to `/policies/{holdingId}`; secondary links `See what we found` to `/covers/review?holding={holdingId}` and `Add health details` to `/covers/declarations?holding={holdingId}` (ids URL-encoded as today).

### R3b.6 Behaviour that must not change

- First load: `uploads.list()` sets consent, the locked policy type, and resumes a schedule still being read (not `DELETING`, not `QUARANTINED`, no holding yet), ahead of the pay screen.
- `?resume=1`: the open holding with no plan is picked up, its candidates load, no payment is asked.
- `payments.slots()` on mount; a failed read is ignored.
- A failed first read never shows the consent screen.
- `CONSENT_REQUIRED` from an upload shows the consent screen again.
- Request keys: one per slot, reused on retry; the confirm key changes only after `INVALID_INPUT`, `HOLDING_PRODUCT_UNSUPPORTED` or `POLICY_PROFILE_VERSION_CONFLICT`.
- Insurer and plan names only. No UIN or registry number on any screen.
- `runSchedule`, `checkSchedule`, `canRetry`, `emptySlot`, `pickFile` are used as they are.

### R3b.7 Removed from this page

`PageTitle`, `SectionHeading`, `covers.module.css` classes, the `k-btn` classes, the consent checkbox and its extra sentences, `{file}: added.`, the line `{file}: {errorText(code)}`.

### R3b.8 No scroll

At 1440x900 and 1280x800 no screen needs scrolling: guesses capped at 3, search results at 4, family rows at 4. `.frame` and `.bare` do not scroll.

### R3b.9 New tests: `tests/components/kv-wizard.test.tsx`

Titles:

1. `screenOf follows the pinned order for every screen`
2. `stepOf maps every screen to its step`
3. `guideFor returns the pinned title, fix and action for every listed code`
4. `guideFor falls back to the retry guidance for an unknown code`
5. `the frame shows four steps and marks the current one`
6. `consent has one button and no checkbox, and granting moves to find`
7. `a held file is sent again after consent is granted`
8. `reading shows the stage heading, the five rows and a bar at the stage percent`
9. `a waiting document is checked again by itself and the timer stops on unmount`
10. `a password-protected PDF shows guidance with Choose another PDF and no code`
11. `a network failure shows Try again and Choose another PDF`
12. `guesses are capped at three and search results at four`
13. `pay shows the price in the heading and the button`
14. `a stopped payment shows its reason and Pay again`
15. `an unconfirmed payment offers Check again and no Pay button`
16. `after paying, the held file goes up without choosing it again`
17. `people lists the family, adds a person and keeps the name on failure`
18. `Skip for now and Continue both reach the cover screen`
19. `cover names the plan and links to the policy, the findings and health details`
20. `AppShell in bare mode has no rail, top bar or ask bar on /covers/add`
21. `AppShell keeps the rail on every other path`
22. `no screen renders an error code`

### R3b.10 Existing tests: what changes

All twelve `it` titles in `add-cover-view.test.tsx` (4), `add-cover-resume.test.tsx` (4) and `consent-upload-states.test.tsx` (4) are kept and must pass. Only these replacements are made, plus an `adapters.members` mock (`list` resolving `[]`, `add` resolving a record) where the test reaches the people screen:

| Old | New |
|---|---|
| tick the checkbox, press `Continue` | press `Yes, read my policy` |
| heading `Your policy schedule` | heading `Drop your policy PDF here.` |
| button `Choose the schedule PDF` | button `Choose PDF` |
| wait for `schedule.pdf: added.` | wait for heading `Which plan is this?` |
| alert text `schedule.pdf: We could not read this document. Add it again` | alert contains `We could not read this one.` |
| after confirm, find link `Open my policy` | press `Skip for now`, then find link `Open my policy` |

### R3b.11 Out of scope

Gmail and DigiLocker sources. Names read from the policy. Linking a person to a policy. Picking a reading when documents disagree. Insurer logos. `CoverReviewView`, `DeclarationsView`. Running Playwright. Any backend, BFF or adapter change. New dependencies.

## R3d Home

Scope: `/home` for a real account. Two equal halves that fit one laptop screen: on the left the greeting, the cover read as one sentence and the one next step; on the right three equal cards. Canvas reference: `design/canvas-v6/screens-z.js`. Data and loading logic (`usePolicies`, `nextStepOf`, `useMe`) are unchanged.

Persona served: a 25 to 35 year old tech worker with one or two health policies. Opening Home answers three things at a glance: how much cover, what is coming up, what to do next. One main action. No small captions.

### R3d.1 Files

| File | Change |
|---|---|
| `src/components/cover-real/RealHome.tsx` | Rewritten body for the `ready` state (R3d.3). Loading, error and empty branches keep their logic. |
| `src/components/cover-real/RealHome.module.css` | Rewritten (R3d.2). |
| `src/components/shell/HomeGreeting.tsx` | The date line (`Kicker`) is removed. Nothing else changes. |
| `tests/components/kv-home.test.tsx` | New (R3d.5). |
| `tests/components/t3-home.test.tsx`, `tests/components/t12-numbers-first.test.tsx`, `tests/adapters/real-policy.test.tsx`, `tests/components/remaining-states-112.test.tsx`, `tests/components/t2-greeting-chip.test.tsx` | Only assertions that name a removed element are updated or deleted (R3d.6). |

Not edited: `src/app/(app)/home/page.tsx`, `parts.tsx`, `use-policies.ts`, adapters, `src/components/ui/*`, `src/components/cover/HomeView.tsx` (mock-only view).

### R3d.2 Layout

`RealHome.module.css`:

- `.home`: `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; flex: 1; min-height: 0;`
- `.left`: one `Card`, `display: flex; flex-direction: column; justify-content: space-between; gap: 24px; padding: 32px;`
- `.right`: `display: grid; grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 24px;` holding three `Card`s, each `padding: 24px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;`
- `.sentence`: Newsreader, 44px, line-height 1.1, weight 500. `.value` (card values): Newsreader, 32px, weight 500. `.label` (card labels): 18px, weight 600. All other text 18px weight 500. Nothing under 16px, no weight under 500.
- Tokens only: no hex colours, shadows, gradients or blur. No `@keyframes`.

### R3d.3 Content (`ready` state)

`policies`, `first`, `next`, `policyHref`, `sumInsured` and `renewal` are computed exactly as today. `<CreationIssues issues={issues} onRetry={reload} />` stays above the grid.

Left card, top to bottom:

1. `<h2 className={sentence}>`:
   - one policy with a found sum insured: `You have {sumInsured.value} of health cover.` with the value inside `<span data-testid="home-cover">` coloured `var(--harbour)`.
   - one policy without it: `Your policy is on Knowvia.`
   - two or more policies: `You have {n} policies on Knowvia.` with `{n}` inside `<span data-testid="home-cover">`. Values of different policies are never added together.
2. Next step block: `<p className={label}>{next.label}</p>`, `<p>{next.detail}</p>`, and the page's one primary action: a link to `next.href` styled as the primary `lg` button with an arrow, text `{next.label}`, `data-testid="home-next"`. Link styles live in `RealHome.module.css` (`.cta`), matching the `Button` primary `lg` box.

Right column, three cards in this order:

1. Policies: `Card as="a" href="/policies"`. Label `Policies`. Value `{policies.length}`. Below, the titles of the first two policies (`p.title`), one per line; with more than two, a last line `and {n - 2} more`.
2. Next renewal: `Card as="a" href={policyHref}`. Label `Next renewal`. With `renewal`: value `{renewal.value}` and `<Signal kind="ok">On your policy</Signal>`. Without: value `Not in your policy` and `<Signal kind="warn">Add it from your policy page</Signal>`.
3. Ask: `Card` (a `div`). Label `Ask about your cover`. Two links, each to `/chat?q={encodeURIComponent(prompt)}` with the prompt as its text, styled as outline buttons: `What are my waiting periods?` and `What does my policy not cover?`.

Removed from Home: `SectionHeading`, `BentoGrid`, `Tile`, `MissingTile`, `SoonTile`, `AskCard`, the "Cover per person" tile, the heading "Your cover at a glance".

### R3d.4 Other states

- `loading`: `<Loading what="your cover" />` (as today).
- `error`: `<ErrorBox code={state.code} onRetry={reload} />` (as today).
- `empty` with creation issues: as today.
- `empty`: `<EmptyState title="Add your first policy" body="Knowvia reads it and shows what it found here." cta="Add a policy" href="/covers/add" />` (as today).

### R3d.5 New tests: `tests/components/kv-home.test.tsx`

Titles:

1. `one policy with a sum insured reads as one sentence`
2. `one policy without a sum insured says the policy is on Knowvia`
3. `two policies show the count and never add values together`
4. `the next step is the only primary action and links to the next step`
5. `the policies card links to My policies and lists at most two titles`
6. `a third policy shows and 1 more`
7. `renewal found shows the date with a green signal`
8. `renewal missing shows Not in your policy with a yellow signal`
9. `ask has two prompts that link to chat with the question`
10. `home has no Soon tile and no Cover per person`
11. `loading, error and empty states are unchanged`
12. `the greeting has no date line`

### R3d.6 Existing tests

- `t3-home.test.tsx`: tests about tile rows, the soon tile and the ask card markup are replaced by the equivalent assertion on the new markup where one exists (`ask card has two prompts`, `no policy cards on Home`, `single primary CTA` keep their titles); the rest are deleted and listed in the report with one reason each.
- `t12-numbers-first.test.tsx`: `RealHome tiles: captions only on Next step` is deleted (no tiles). `FactItem` tests untouched.
- `tests/adapters/real-policy.test.tsx`: `RealHome` assertions that query a removed tile label are rewritten against the new markup; every other test in the file is untouched and must pass.
- `remaining-states-112.test.tsx`, `t2-greeting-chip.test.tsx`: only an assertion on the date line, if present, is removed.
- `tests/styles/touch-targets-84.test.ts` must still pass unchanged (`className="k-no-fade"` stays in `HomeGreeting.tsx`).

### R3d.7 Out of scope

Insurer logos. Any statistic about the population. Cover per person. Days-to-renewal arithmetic. `/chat` reading `?q=`. Mock `HomeView`. New dependencies.

## R3e My policies and policy detail

Scope: `/policies` and `/policies/[id]` for a real account. The list becomes a symmetric grid of policy cards, four to a page. The detail becomes a header plus tabs, so one group of facts shows at a time and the page does not scroll. Data, loading logic and the shared pieces in `parts.tsx` are unchanged. Canvas reference: `design/canvas-v6/screens-b.js`.

Persona served: a 25 to 35 year old tech worker with one or two health policies who wants to see each policy's main numbers at a glance and open one to read a group of details at a time. Colour tells them what is fine and what needs them.

### R3e.1 Files

| File | Change |
|---|---|
| `src/components/cover-real/RealPolicies.tsx` | `ready` state rewritten (R3e.2). Other states keep their logic. |
| `src/components/cover-real/RealPolicyDetail.tsx` | Layout rewritten as header plus tabs (R3e.3). The refresh effect and all conditions stay. |
| `src/components/cover-real/policies.module.css` | New. Styles for both screens. |
| `tests/components/kv-policies.test.tsx` | New (R3e.5). |
| `tests/adapters/real-policy.test.tsx`, `tests/components/real-policy-detail.test.tsx`, `tests/components/wording-cutover.test.tsx`, `tests/components/t12-numbers-first.test.tsx` | Only assertions that depend on removed list markup or on a fact being visible without choosing its tab are updated (R3e.6). Every title is kept. |

Not edited: `parts.tsx`, `MemoryDocument.tsx`, `PassageSearch.tsx`, `use-policies.ts`, `covers.module.css`, `src/components/covers/format.ts`, adapters, `src/components/ui/*`, `src/app`.

### R3e.2 `/policies`

Loading, error and both empty branches render what they render today, in the same order. `PageTitle` "My policies" stays the only `h1`.

`ready`:

- `<CreationIssues issues={issues} onRetry={reload} />` first (as today).
- A header row: left `<p data-testid="policy-count">` with `1 policy` or `{n} policies` (18px, weight 600); right a link `Add a policy` to `/covers/add` styled as the primary button (`.cta`).
- `PAGE_SIZE = 4`. The grid `.grid` shows `policies.slice(page * 4, page * 4 + 4)` in two equal columns (`grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px`), rows of equal height.
- More than four policies: a pager row under the grid with outline buttons `Back` and `Next` (disabled at the ends) and the text `Page {page + 1} of {pages}` in a `role="status"` element. Four or fewer: no pager.
- Each policy is a `Card as="a"` linking to `/policies/{encodeURIComponent(p.id)}`, `aria-label={p.title}`, `data-testid="policy-card"`, containing in order:
  1. Top row: a square badge with the first letter of `p.insurer ?? p.title` (upper case, `aria-hidden`), then `<h3>` `p.title` and, when set, `p.insurer`.
  2. Headline row: one cell per entry of `p.headlines` (up to three, equal columns). Each cell: label (16px, weight 600), value (Newsreader, 28px, weight 500) and a `Signal` chosen by `tone`: `read` or `confirmed` gives `<Signal kind="ok">{h.statusText}</Signal>`; `review` gives `<Signal kind="warn">Needs your decision</Signal>`; `missing` gives `<Signal kind="warn">Not found yet</Signal>`. With no headlines the row is omitted.
  3. State row, one `Signal`, first match: `p.error` set: `<Signal kind="bad">Could not load. Open to try again.</Signal>`; `p.stage === "reading"`: `<Signal kind="warn">Still being read</Signal>`; `p.stage === "choose_plan"`: `<Signal kind="warn">Tell us which plan this is</Signal>`; `p.pending.length > 0`: `<Signal kind="warn">{n === 1 ? "One detail needs your decision" : `${n} details need your decision`}</Signal>`; otherwise `<Signal kind="ok">Read and ready</Signal>`.
- `PolicyCard` from `parts.tsx` is no longer used on this page.

### R3e.3 `/policies/[id]`

Loading, error and not-found branches are unchanged. The wording refresh effect is unchanged.

Root `.detail`: `display: flex; flex-direction: column; gap: 20px; flex: 1; min-height: 0`.

1. Header row (`.head`, space between): left `PageTitle` `{p.title}` and, when set, `p.insurer` (18px); right two links: `All policies` to `/policies` (outline) and `Ask about this policy` to `/chat?holding={encodeURIComponent(p.id)}` (primary, `.cta`).
2. `Tabs` (`label="Policy sections"`), tab ids and labels in this order, each only when its condition holds:
   - `glance` "At a glance": always.
   - one tab per group in `GROUP_ORDER` that has facts (id is the group label lower-cased with spaces replaced by `-`, label is the group label): as today's `groups`.
   - `not-found` "Not found": when `p.notFound > 0`.
   - `terms` "Insurer terms": when `p.stage` is `needs_review` or `ready`.
   The selected tab starts as `glance`.
3. Panels. Every panel is rendered in the DOM as `<div role="tabpanel" data-panel={id} hidden={id !== selected}>`; only the selected one is visible. Panel content:
   - `glance`: `p.error ? <ErrorBox code={p.error} onRetry={reload} /> : <StageBox p={p} onRetry={reload} />`, `<Pending p={p} />`, `<Headlines p={p} />` when there are headlines, and the line `Nothing has been read from this policy yet.` under today's condition.
   - a group: `<ul>` of that group's facts through `FactItem`, laid out in two equal columns, eight to a page (`FACT_PAGE = 8`), with the same `Back` / `Next` / `Page x of y` pager as the list when the group has more than eight.
   - `not-found`: a heading-less list of `labelOf(k)` for `p.notFoundKeys`, in three equal columns, and the count in the tab label as `Not found ({p.notFound})`.
   - `terms`: `<TermsStatus p={p} onAdded={reload} />`, `<MemoryDocument holdingId={p.id} />`, `<PassageSearch holdingId={p.id} />`. This panel alone may scroll inside itself (`overflow-y: auto`).
4. Removed from this page: `SectionHeading`, the `<details>` element, the bottom link row, `k-btn` classes.

### R3e.4 Styles

`policies.module.css`: theme tokens only; no hex colours, shadows, gradients, blur or `@keyframes`; font sizes in px, none under 16px; no weight under 500. `.cta` and `.outline` match the `Button` primary and outline `md` boxes. Panels other than `terms` have `overflow: hidden`.

### R3e.5 New tests: `tests/components/kv-policies.test.tsx`

Titles:

1. `the list shows the count and an Add a policy link`
2. `each policy is one card that links to its page`
3. `headline tones map to green and yellow signals`
4. `the state signal follows error, reading, choose plan, pending, ready in that order`
5. `four or fewer policies show no pager`
6. `a fifth policy moves to page two and Back returns`
7. `loading, error and empty list states are unchanged`
8. `detail starts on At a glance with the stage note, pending note and headlines`
9. `detail has one tab per fact group that has facts, in the fixed order`
10. `choosing a group tab shows its facts and hides the others`
11. `a group with nine facts pages at eight`
12. `Not found tab shows the count and the labels`
13. `Insurer terms tab appears only when the policy is ready or needs review`
14. `detail header links to all policies and to ask about this policy`
15. `policy not found and detail error states are unchanged`

### R3e.6 Existing tests

Every title in the four listed files is kept and must pass. Allowed edits: a query that relied on `PolicyCard` markup on the list (the `Open policy` link, key facts on the card) is rewritten against the new card; a `role`-based query for content inside a non-selected panel first clicks that tab; the `<details>` summary query for not-found keys becomes a click on the `Not found` tab. Text queries that still find their text need no change.

### R3e.7 Out of scope

Insurer logos. Compare, stress test, hospitals, review screens. Restyling `parts.tsx`, `MemoryDocument`, `PassageSearch`. Adapters. New dependencies.

## R4a Real-account screens in the browser (test harness)

Scope: a Playwright harness that renders the real-account screens (the ones a signed-in person sees) on a dev server in backend mode, with no backend behind it, by answering the browser's own `/api/app/*` calls with synthetic data. It proves in a real browser what unit tests cannot: nothing scrolls, no small or thin text, the laptop gate works. No product code changes.

Persona served: the owner and reviewers, who judge the product by what the screen looks like for a real account, and the end user (a 25 to 35 year old tech worker on a laptop) who must never scroll or squint.

### R4a.1 Files

| File | Change |
|---|---|
| `playwright.real.config.ts` | New. `testDir: "e2e"`, `testMatch: "real-screens.spec.ts"`, port from `process.env.KV_E2E_PORT` (default `3312`), viewport 1440x900, web server command `NEXT_PUBLIC_ADAPTERS=backend npx next dev -p <port>` (any value other than `mock` puts the browser adapters in backend mode, so they call `/api/app/*`), `reuseExistingServer: false`. |
| `playwright.config.ts` | One added line: `testIgnore: "real-screens.spec.ts"`, so the mock suite never runs the real-account spec. Nothing else changes. |
| `e2e/real-account.ts` | New. `export async function asRealAccount(page: Page, opts?: { policies?: 1 | 2 | 5 }): Promise<{ unhandled: string[] }>`. |
| `e2e/real-screens.spec.ts` | New (R4a.3). |

Not edited: everything under `src/`, `tests/`, other `e2e/` files, `package.json`.

### R4a.2 `asRealAccount`

- Registers `page.route("**/api/app/**", ...)` before any navigation and fulfils each request the shell and the real screens make (session, preferences, onboarding, members, payment slots, document list and consent, holdings, facts, conflicts, memory document, passages, scenarios and any other path they call) with JSON that passes the same zod contract the browser adapter parses (`src/adapters/covers-contract.ts`, `src/adapters/documents-contract.ts`, `src/adapters/scenarios.ts`, `src/adapters/payments.ts`, and the session shape read by `src/components/shell/useMe.ts`). Shapes are copied from those files, never guessed.
- The session answer makes `me.source` equal `"backend"`, so `DemoGate` shows the real screens. The owner is `Asha Rao`.
- Holdings: `opts.policies` (default 2) holdings with ids `h1`, `h2`, ... Holding `h1`: insurer `Example Insurer`, product `Example Health Plan 01`, stage ready, a confirmed sum insured of 500000 rupees, a policy period, a premium, and at least nine facts spread over the groups Limits, Waiting and Exclusions (so one group pages), one of them `renewal_date`, plus two not-found keys. Other holdings: a different product name each, ready, sum insured only.
- Any `/api/app/*` request with no fixture is fulfilled with status 404 and body `{"code":"NOT_FOUND"}` and its method and path are pushed to the returned `unhandled` array.
- Synthetic data only: no real person, policy number, insurer document or key. No request may reach `/api/v1`.

### R4a.3 `e2e/real-screens.spec.ts`

Sign-in for every test: no form. Before the first navigation the test calls `asRealAccount(page)`, which itself adds the plain session cookie the proxy looks for (`kv_session`, any value, for the base URL) with `page.context().addCookies`. The proxy only checks that the cookie exists; every session read after that is a browser call to `/api/app/me`, which the harness answers.

Safety: the dev server is started with no backend address (the worktree has no local env file), and `asRealAccount` aborts and records any browser request to a host other than the base URL's.

A helper `expectCalm(page)` asserts, in the page:
- `document.documentElement.scrollHeight <= window.innerHeight + 1`;
- the `main` element's `scrollHeight <= clientHeight + 1`;
- no visible element that directly holds text has a computed `font-size` under 16px;
- no such element has a computed `font-weight` under 500.
Elements inside `[data-panel="terms"]` are skipped for the scroll rule only.

Tests (titles):

1. `home shows the cover sentence and one next step for a real account`
2. `home is calm at 1440x900 and 1280x800`
3. `my policies shows one card per policy and no pager for two`
4. `five policies page at four`
5. `my policies is calm at 1440x900 and 1280x800`
6. `policy detail opens on At a glance and switches to a fact group`
7. `a group of nine facts pages at eight`
8. `policy detail is calm at 1440x900 and 1280x800`
9. `the wizard is calm on every step at 1440x900`
10. `under 1024px wide the laptop gate shows and the app is hidden`
11. `no call reaches the backend API and no app call is unhandled`

Each test that visits a screen saves a full-viewport screenshot to `test-results/real/<screen>-<width>.png`.

A test that fails because the product breaks a rule (for example Home scrolls at 1280x800) is a finding, not a harness bug: the builder does not change product code or weaken the assertion; it reports the failing test, the measured numbers and the screenshot path.

### R4a.4 Out of scope

Any change under `src/`. Other screens (compare, stress test, hospitals, Ask, family, money, settings). Visual snapshot comparison. CI wiring. New dependencies.

## R5a Calm fixes found in the browser

Scope: fix what the browser harness (R4a) measured on Home, My policies and policy detail: thin text, small text, a scrolling Home, clipped policy cards and clipped fact rows. The judge is the harness: tests 2, 5 and 8 of `e2e/real-screens.spec.ts` must pass. This section replaces R3e where they differ (fact page size, card headline layout, At a glance).

Persona served: a 25 to 35 year old tech worker on a laptop. Every number is readable at a glance, nothing is cut off, nothing scrolls, no thin or small text.

### R5a.1 Findings being fixed (measured at 1440x900 and 1280x800)

1. Home: `main` scrolls (content 889px in 748px and 648px).
2. Text at weight 400: page titles, headline values, fact values, citation lines.
3. Insurer terms tab: text at 12px, 13px and 14px (inline styles in `MemoryDocument.tsx`).
4. My policies: card content is cut off (a long policy period wraps and hides the state row); "Not found yet" shows twice in a cell.
5. Policy detail: the fourth row of facts is cut off; At a glance shows three small values and an empty page.

### R5a.2 Files

| File | Change |
|---|---|
| `src/styles/app-theme.css` | Add, inside the app scope only: `.kv-app h1, .kv-app h2, .kv-app h3 { font-weight: 500; }` and `.kv-app p { font-weight: 500; }`. Nothing else. |
| App-only CSS modules (R5a.3 list) | Weight literals 300, 400 and `normal` become 500. |
| `src/components/cover-real/MemoryDocument.tsx` | Inline `fontSize` values under 16 become 16; inline `fontWeight` under 500 becomes 500. Nothing else. |
| `src/components/cover-real/RealHome.tsx`, `RealHome.module.css` | Home fits (R5a.4). |
| `src/components/cover-real/RealPolicies.tsx`, `RealPolicyDetail.tsx`, `policies.module.css` | Card and detail fixes (R5a.5, R5a.6). |
| `e2e/real-screens.spec.ts`, `e2e/real-account.ts` | Title 7 becomes `a group of nine facts pages at six`; its assertions follow; every `page.screenshot` call passes `animations: "disabled"`. No rule in `expectCalm` changes. |
| `tests/components/kv-policies.test.tsx`, `tests/components/kv-home.test.tsx`, other unit tests that fail only because of a change pinned here | Updated to the pinned markup. Title `a group with nine facts pages at eight` becomes `a group with nine facts pages at six`. |

Not edited: `src/styles/tokens.css`, `src/styles/globals.css`, `src/components/type/type.module.css`, `src/components/public/landing.module.css`, `src/components/public/tones.module.css`, `src/components/public/Landing.tsx`, `src/components/public/Tour.tsx`, `src/components/cover-real/parts.tsx`, adapters, `src/app`, `package.json`.

### R5a.3 Weights

In every `*.module.css` under these folders: `src/components/{access,agent,chat,cover,cover-real,covers,family,help,money,onboarding,palette,profile,shell,tools,ui,upload,wallet}` and in `src/components/public/signin.module.css` and `src/components/public/legal.module.css`:

- `font: 300 ` and `font: 400 ` become `font: 500 `;
- `font-weight: 300`, `font-weight: 400` and `font-weight: normal` become `font-weight: 500`.

Nothing else in those files changes. The shared `type.module.css` title is covered by the new `.kv-app h1, .kv-app h2, .kv-app h3 { font-weight: 500; }` rule in `app-theme.css`, plus `.kv-app p { font-weight: 500; }` for its description line.

### R5a.4 Home

- `RealHome` no longer uses the `.stack` wrapper from `covers.module.css`. Its root is `<div className={rows.page}>`: `display: flex; flex-direction: column; gap: 24px; flex: 1; min-height: 0;`.
- `.home` keeps two equal columns and `flex: 1; min-height: 0`. The left card and the three right cards shrink to the space there is: `.left` and `.right > *` get `min-height: 0; overflow: hidden`.
- Under `@media (max-height: 860px)`: `.sentence` is 36px, `.value` is 26px, card paddings are 20px and the gaps 16px. No font goes under 16px.
- Content, copy, test ids and order do not change.

### R5a.5 My policies

- The count and the `Add a policy` link move onto the title row: `PageTitle` on the left, then `<p data-testid="policy-count">`, and the link on the right, in one flex row. There is no separate header row.
- The grid fills the rest of the page: `flex: 1; min-height: 0; grid-auto-rows: minmax(0, 1fr)`; cards have `overflow: hidden`.
- Headline cells inside a card become stacked rows (one per headline), each row: a `Signal` dot (same kind as R3e.2: `ok` for `read` and `confirmed`, `warn` for `review` and `missing`), the label on the left (18px, weight 600) and the value on the right (Newsreader, 22px, weight 500, `text-align: right`). The Signal's text is the label itself; no second status text is shown. For `missing` the value is `Not found yet`; for `review` the value is `Needs your decision`.
- The state row (R3e.2 item 3) stays as the last row of the card and is always visible.
- `PAGE_SIZE` stays 4. The pager stays.

### R5a.6 Policy detail

- `FACT_PAGE` becomes 6 (three rows of two).
- Group panels: `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 16px`, filling the panel height; the pager sits under the grid.
- At a glance: the headlines are no longer rendered through `Headlines` from `parts.tsx`. They render as three equal `Card`s in one row inside `<ul data-testid="headlines">`, each `<li data-testid={`headline-${h.key}`} data-tone={h.tone}>` holding the label (18px, weight 600), the value (Newsreader, 32px, weight 500) and one `Signal` (`ok` with `h.statusText` for `read` and `confirmed`; `warn` with `Needs your decision` for `review`; `warn` with `Not found yet` for `missing`). A `review` headline also has the link `Review and decide` to `/covers/review?holding={id}`.
- `StageBox`/`ErrorBox` and `Pending` stay above the headline row, unchanged.

### R5a.7 Done means

`KV_E2E_PORT=3312 npx playwright test -c playwright.real.config.ts e2e/real-screens.spec.ts` passes all 11 tests, and the whole unit suite passes. If a calm test still fails after the pinned changes, the builder may reduce paddings and gaps in the three screen CSS modules (never a font under 16px, never weight under 500, never removing content) and reports what it changed.

### R5a.8 Out of scope

New content, logos or illustrations. Other screens' layout. `parts.tsx`. Shared type or global styles. The landing page. New dependencies.
