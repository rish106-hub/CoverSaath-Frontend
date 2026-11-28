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
