# F1b: Profile page (Sonnet medium build brief)

Launch as: Agent tool, `model: "sonnet"`, `effort: "medium"`, worktree `Knowvia Frontend.worktrees/f1b-profile` (branch `feat/profile`; already created from main; `git merge --ff-only main` first, then `rm -rf node_modules && npm ci`).

Rules: work only in that worktree; no push (no remote); no `.env` access; commit per passing slice, ending each commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Agent F1a is changing button CSS and the sidebar brand elsewhere: do not edit `AppSidebar.tsx`, `src/styles/*`, or other modules' button CSS. New CSS for this page uses existing tokens; it will be migrated to the shared `.k-btn` styles later (use the class names `.btn`/`.btnPrimary` inside your own module so the sweep is easy).

## Owner decisions this implements (2026-11-01)
- "Fetch from digilocker if possible else optional add on in the profile section; there has to be a profile section also."
- Registered address: DigiLocker if possible, else optional manual entry. Current location: kept 24 hours at about 1 km, exact only in the Emergency flow.
- Everything the person enters will later be stored in the backend, sealed (spec: `/Users/rishavdewan/Developer/Product experiments/CoverSaath/docs/exec-plans/active/user-data-store-spec.md`, read sections 2-5). This agent builds the UI and adapter contract only; the BFF and backend wiring is a later step (P2a). Mark mock parts `// backend gap: wired in P2a`.

## Build
1. Route `/profile` under `src/app/(app)/profile/`. Add it to `src/lib/ia.ts` PAGES with `group: null` (like settings), title "Your profile", and to the command palette. Reach it from the sidebar user chip (`UserChip.tsx` links to /profile; keep sign-out reachable) and add a page shortcut in `src/lib/shortcuts.ts` that does not collide (the collision test must stay green; no printed hint text).
2. Sections, with the Mobbin-style 20/600 ruled headings and grey one-line descriptions used elsewhere (no pill/circle eyebrows, no defensive/sample/draft copy):
   - **You**: name, email (read from the signed-in session via the shared `useMe` store), mobile number (editable, +91 10-digit validation).
   - **Registered address (optional)**: a primary "Fetch from DigiLocker" button and a secondary "Add it yourself". Fetch calls `adapters.profile.fetchAddressFromDigiLocker()`: the mock simulates the connected flow with a short delay and returns the synthetic Rao family address; on failure show a calm error and keep the manual form open. The manual form: line 1, line 2, landmark, city, state (select of Indian states and UTs), pincode (6 digits, first digit 1-9). Saved address shows as a read-only card with Edit and Remove buttons. Both paths end in the same `saveAddress`.
   - **Location**: permission state shown as Allowed / Not allowed / Not asked, an "Allow location" button that calls `navigator.geolocation.getCurrentPosition` (SSR safe, handles denial and unavailable), shows "Current place: about 1 km (kept for 24 hours)" with a Clear button; saved places Home and Work (label + address text, add/remove).
   - **Connected sources**: Gmail, DigiLocker, ABHA with their logos (reuse `BrandLogo`/`OfficialLogo` split exactly as `SettingsView` does) and Connected / Not connected state.
   - **Your account**: Sign out.
3. Adapter contract in `src/adapters/types.ts`: `ProfileAdapter` with `get()`, `saveContact({mobile})`, `saveAddress(address)`, `deleteAddress()`, `fetchAddressFromDigiLocker()`, `setPermission(permission, state, surface)`, `saveCurrentLocation({lat,lng,accuracyM,precision})`, `clearCurrentLocation()`, `savePlace(kind,label,address)`, `deletePlace(id)`. Shapes match the spec's `household_places` and `device_permissions` columns (address `{line1,line2,landmark,city,state,pincode,country}`; location `{lat,lng,accuracyM}` rounded to 2 decimals for `coarse`). Zod schemas in `src/adapters/schemas.ts`. Mock in `src/adapters/mock/` (in-memory per session, small delay) and register it in `adapters/index.ts` as `adapters.profile`.
4. A reusable `SaveState` component (`src/components/ui/SaveState.tsx`): shows "Saving", "Saved" or "Could not save. Retry" next to a control, `aria-live="polite"`. Every save on this page uses it, and a failed save never discards what the person typed. Use the existing `useSingleFlight` hook (from the stability work) for every async button so double clicks send one request.
5. Round the location: when saving the browser position as `coarse`, round lat/lng to 2 decimals in the adapter before it leaves the component.
6. Layout: the page works inside the pinned sidebar shell (nothing extra to do), single column up to 720px content width, 360px phones fine, dark mode via tokens only, no horizontal scroll.

## Tests
Vitest + Testing Library: renders all sections; pincode and mobile validation; DigiLocker fetch success fills the card; failure shows the error and manual form; manual save then Edit/Remove; geolocation granted, denied and unavailable paths (mock `navigator.geolocation`); coarse rounding; Clear; double-click on Save sends one `saveAddress`; routes smoke test and banned-words test in `tests/routes.test.tsx` stay green; shortcut collision test stays green; `PAGES` loop test (sidebar present on every route) stays green.

## Checks before reporting (in the worktree)
`npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`; quote real tails. A timing flake in a loaded full run: rerun that file alone and say so. Never weaken a test.

## Report (under 25 lines)
Files added/changed, adapter methods, the shortcut chosen, check results with numbers, and exactly what is NOT verified (no browser; real DigiLocker is a mock; nothing is stored in the backend yet).
