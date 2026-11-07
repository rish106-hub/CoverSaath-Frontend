# Mock data in production

Production runs with `NEXT_PUBLIC_ADAPTERS` unset, so `useBackend` is true (`src/adapters/mode.ts`). `src/adapters/index.ts` still starts from `...mockAdapters` and swaps in the backend for 7 adapters only: access, household, profile, preferences, onboarding, scenarios, members. Everything else in this document reaches invented data in prod. The family, insurers, numbers and hospitals are synthetic (the Rao family, Northstar, Kaveri, Meridian).

This is an inventory for an owner decision. Nothing here was removed or hidden except what is listed under "Already handled". The actions are: **wire** (needs a backend table or route), **flag** (hide the control behind a `features` flag, `src/adapters/features.ts`), **label** (keep the screen, mark it as an example in product copy; the owner decides the wording, this project's rule is no sample or draft labels, so label is the weakest option).

## Already handled

| What | Where | State |
|---|---|---|
| Household members beyond the owner | `src/adapters/backend.ts` `backendHousehold.household` | Real mode returns the owner plus the stored members only. Mock family is no longer mixed in. |
| Profile mobile, DigiLocker fetch, member contact and invite, advisor booking, per-person sharing | `src/adapters/features.ts` | Off in prod, see `docs/persistence-matrix.md`. |

## Adapters that stay mock in prod

Path:line is `src/adapters/mock/index.ts` (the object that `index.ts` spreads).

| Adapter (line) | Used by | What the user sees in prod | Recommended |
|---|---|---|---|
| `auth` (19) | `components/public/SignIn.tsx:49,52,78,79,106,107`; `components/access/AccessCard.tsx:69` | Sign-in with Google, Apple, phone code or e-mail link reports success without checking anything. Any six digits pass. No session is created by these paths (only `access.submit` creates one). | wire (a backend auth branch exists, `feat/auth-jwt`, not merged); until then flag the extra sign-in methods off and keep only the access form |
| `document` (44) | `components/palette/CommandPalette.tsx:28` | Command palette lists invented documents. `add` returns a made-up id and stores nothing. | wire (the backend has a document upload pipeline) or flag the documents group off in the palette |
| `reading` (48) | `components/onboarding/Flow.tsx:153`; `components/cover/PolicyReader.tsx:25` | Findings for "northstar-floater" and other invented policies. Same text for every person. | wire (policy-evidence backend) or flag the reading step off |
| `policy` (49) | `components/cover/PolicyReader.tsx:25`; `components/cover/PolicyList.tsx:24` | "My policies" shows three invented policies with fixed members (Meera, Rohan, Kabir ids). For a real person the member chips fall back to the raw id. | wire (policies per household) or hide the page until stored policies exist |
| `assistant` (53) | `components/agent/AgentProvider.tsx:139` | Ask answers come from `src/agent/responder.ts`, which reads the invented household and policies. Answers name Meera, Rohan and the invented insurers. | wire (assistant route) or flag the Ask panel to navigation commands only |
| `voice` (56) | `components/agent/AgentProvider.tsx:162-265`; `AskChatPane.tsx:17`; `AskPanel.tsx:72` | Real browser speech recognition (not mock data). The recognised text goes to the mock assistant above. | keep; follows `assistant` |
| `email` (57) | no component calls it | Not reachable from a screen. | remove when convenient |
| `reconcile` (58) | no component calls the adapter (`MoneyDesk` uses `lib/reconcile` directly on invented receipts) | See MoneyDesk below. | wire with MoneyDesk |
| `desk` (61) | `components/agent/AskStrip.tsx:19`; `components/help/DeskView.tsx:25` | Claims desk and the Ask strip show five invented cases (cataract pre-approval, claim form). | wire (claims) or hide the desk page |
| `hospital` (62) | `components/help/EmergencyView.tsx:70` | Emergency lists invented hospitals ranked for the issue picked. A real person in an emergency would be sent to a made-up hospital. **Highest risk.** | wire (hospital directory) or flag Emergency hospital list off; do not ship as is |
| `blood` (63) | `components/help/EmergencyView.tsx:56,63` | Invented blood stock and banks. Same risk as hospitals. | wire or flag off together with hospitals |
| `learn` (68) | no component calls the adapter (`AppSidebar.tsx:6` imports `readingList` from the mock directly) | Sidebar reading list is invented titles. | label or wire (content) |
| `invite` (69) | `components/family/AddMemberSheet.tsx:73`; `EditMemberSheet.tsx:45` | Off in prod via `features.memberContact`. In mock mode "Invite sent" is shown with nothing sent. | handled by flag; wire when an invite service exists |
| `wallet` (73) | `components/wallet/CardsPage.tsx:19`; `WalletSheet.tsx:18,42` | E-card pass is the invented Meera Rao card. "Added" appears with no pass issued. | wire (pass issuing) or flag the wallet add buttons off |
| `notify` (77) | `components/remind/RemindRow.tsx:38`; `help/EmergencyView.tsx:38,47`; `help/SettingsView.tsx:162` | "Reminder sent" and "Sent on WhatsApp" confirmations with nothing sent. Emergency "send e-card" and "route to" confirm falsely. | wire (messaging service) or flag the send buttons off. Emergency sends are the highest risk. |

## Components that import mock data directly

These bypass adapters, so even a wired adapter would not change them. Line is the first import of mock data.

| Component:line | What the user sees in prod | Recommended |
|---|---|---|
| `components/cover/HomeView.tsx:7` (`home.ts`) | Home dashboard: health score, glance tiles, per-person bars, year tiles, all invented, for every signed-in person. | wire (needs policies and members) or flag dashboard sections off |
| `components/cover/slots.tsx:7`, `cover/CountUp.tsx:5` | Year tiles on Home. | with HomeView |
| `components/cover/PolicyReader.tsx:7` | Invented policy document pages and topics. | with `policy` and `reading` |
| `components/cover/ReviewView.tsx:6` | Review decisions and "look at" items are invented; checks and flags are saved (scenario `review_state`) against invented ids. | wire or hide |
| `components/family/FamilyView.tsx:10`, `family/slots.tsx:4` | Family page people cards (Meera, Rohan, Kabir, Mother, Father), policy matrix, "Family on Knowvia" invites, "Who sees what" switches (local state, not stored), key dates. Stored members are appended only to the invite list. | wire (members, policies, sharing) or hide the page |
| `components/family/AddMemberSheet.tsx:5`, `EditMemberSheet.tsx:6` | Relation chips and "what happens next" copy only (static options, not data). | keep |
| `components/money/MoneyDesk.tsx:10` | Money desk: invented receipts, expected premiums, renewals, per-person spend. | wire or hide |
| `components/money/InflationPlanner.tsx:6` | Who and treatment choices from the invented family. The inputs are saved. | wire `planWho` to stored members |
| `components/tools/ToolsPage.tsx:11` | Advisors off in prod. Exit asks, wins, more tools, read next are invented editorial content. Top-up finder is a session-only calculator. | label or wire content |
| `components/help/EmergencyView.tsx:7` | Emergency people (invented names, policy numbers, ABHA ids) and issues. A real person sees Meera's e-card. **Highest risk.** | flag off or wire to stored members and policies |
| `components/help/DeskView.tsx:6` | Desk steps, escalation ladder, contacts, live status, score. | with `desk` |
| `components/help/AssistantView.tsx:5`, `ShortcutsView.tsx:5` | Example utterances and palette demo text. Editorial. | keep or label |
| `components/wallet/CardsPage.tsx:9`, `WalletSheet.tsx:7`, `PassCard.tsx:6` | Wallet cards and share targets for the invented family. | with `wallet` |
| `components/onboarding/Flow.tsx:16` | Onboarding people, tips, wins and the reading demo (`READING_FINDINGS`, `READING_SAY`) are fixed. The choices are saved. | keep choices; wire the reading step with `reading` |
| `components/shell/AppSidebar.tsx:6` | Reading list titles. | label or wire (content) |
| `components/public/Landing.tsx:11`, `Tour.tsx:3`, `SignIn.tsx:13` | Public marketing copy and example cards. Editorial, signed out. | keep |
| `agent/responder.ts:2` | See `assistant`. | with `assistant` |

## Suggested order

1. Emergency (`hospital`, `blood`, `notify`, `EmergencyView` people): a wrong answer here has real-world cost. Flag off or wire first.
2. Anything that confirms an action that did not happen: `notify`, `wallet`, `auth` extras, `document.add`.
3. Per-person pages shown for the invented family: Home, Family, Policies, Money, Review.
4. Editorial content: keep.

## Checking this list

`grep -rn "@/data" src | grep -v "^src/data\|^src/adapters/mock"` lists the components. `src/adapters/index.ts` lists which adapters are real.
