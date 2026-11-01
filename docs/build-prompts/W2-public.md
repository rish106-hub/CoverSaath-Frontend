<task id="W2" branch="feat/public" base="W0 commit on main" model="sonnet-5.5" effort="medium">
Build the public and first-run screens.

<boards>Landing, Auth, Onboarding, Wallet.</boards>

<build>
1. `/` beta page from `design/Landing.dc.html`: one screen (≈ 940 px at 1440 wide), exactly the content in BUILD-SPEC section 6 row "Landing". The tour is built from real React mini-screens (not video), auto-advances every 4 s, pause/play, progress strip, stops auto-advance with reduced motion. The 4 "Meera's family" stats are buttons that set the tour scene; the active stat follows the tour; one story line below. Access card: Google button, name + email fields (real inputs, Tab moves, Enter submits), zod validation, `AccessAdapter.requestAccess({name, email})` (mock stores it and returns a user id), success state → `/welcome`.
2. `/signin` from `design/Auth.dc.html` via `AuthAdapter`: Google, Apple, phone OTP (6 boxes, auto-advance, paste), email link.
3. `/welcome/*` from `design/Onboarding.dc.html`: Add (4 tiles + "Can't find your policy?" tips), Reading (timed findings from `ReadingAdapter`, never blank), People, Ready with **Save card to wallet** (`WalletAdapter`: detect Apple / Google / Samsung from user agent, show the matching button first, the others under "Other wallets"; share with family via WhatsApp/SMS).
4. `/cards` from `design/Wallet.dc.html`.
5. Each page registers its Ask Knowvia page context (W1 hook; if W1 is not merged on your branch, export the context object and leave a `// W6: register` note).
6. Tests: access form validation, OTP paste, wallet detection by user agent.
</build>

<owns>src/app/page.tsx, src/app/signin/**, src/app/welcome/**, src/app/(app)/cards/**, src/components/public/**, src/components/onboarding/**, src/components/wallet/**.</owns>
</task>
