# Persistence matrix (P2a: profile, settings, emergency, onboarding)

Every value a person types or chooses on these pages is saved through the BFF to the backend user-data store (ADR 0015, sealed columns). Wired means the page loads it on mount, saves it on change with a visible state (Saving, Saved, Could not save with Retry), and keeps the typed value when a save fails. Tools, Compare, Stress, Review and Family scenarios are P2b.

BFF routes: `/api/app/permissions`, `/api/app/places`, `/api/app/preferences`, `/api/app/onboarding` (same-origin marker header, sealed session cookie, zod allow-lists, `revision` in the body becomes `If-Match`). Browser code: `src/adapters/user-data.ts`. Server code: `src/server/backend/user-data.ts`. Wire contract: `src/adapters/user-data-contract.ts`.

| Field | Page and control | BFF route | Backend table | Status |
|---|---|---|---|---|
| Registered address (typed or DigiLocker result) | Profile, address form | `PUT/DELETE /api/app/places` kind `registered_address` | `household_places` | wired |
| Current location, coarse (about 1 km, 24 h) | Profile, Allow location | `PUT/DELETE /api/app/places` kind `current_location` | `household_places` | wired |
| Current location, exact | Emergency, Allow location | same, `surface: emergency` | `household_places` | wired |
| Saved places Home, Work (address, city, state, pincode) | Profile, Saved places | `PUT/DELETE /api/app/places` kind `saved_place` | `household_places` | wired |
| Permission `location` | Profile, Emergency | `PUT /api/app/permissions` | `device_permissions` | wired (revoke or deny erases the stored position on the backend) |
| Permission `notifications` | Settings, WhatsApp and Email switches | `PUT /api/app/permissions` | `device_permissions` | wired (granted while either is on, revoked when both are off) |
| Permission `calendar` | Settings, Calendar switch | `PUT /api/app/permissions` | `device_permissions` | wired |
| Connected sources, notification channels, family sharing, voice language, reduce motion, theme | Settings (theme also from the header toggle) | `GET/PUT /api/app/preferences` | `adult_preferences` | wired, with the enum limits below |
| Onboarding step, way, people toggles, completed | Welcome flow | `GET/PUT /api/app/onboarding` | `onboarding_progress` | wired, with the enum limits below |
| Wallet choice | Save card to wallet | `PUT /api/app/onboarding` (`wallet`) | `onboarding_progress` | wired (Samsung is stored as `google`) |
| Mobile number | Profile, You | none | none | not wired: no backend route stores a mobile number for a signed-in person (only on sign-up); kept for the visit |
| DigiLocker fetch | Profile | none | none | not wired: mock fetch; the result is saved as the registered address |

Enum limits (the backend lists are closed; a backend change is needed to avoid these):

- Sources: Gmail is `email`, DigiLocker is `digilocker`, ABHA is stored as `documents`.
- Notification channels: Calendar is stored as `push`.
- Sharing: the contract holds one family-view switch, not one per person. On means the default people (Rohan, Mother), off means nobody.
- Voice: "Both" is stored as no voice language; English is `en-IN`, Hindi `hi-IN`.
- Onboarding way: DigiLocker is `connect`, Upload `upload`, Forward the HR mail `talk`, Policy number `skip`.

Behaviour notes:

- Revision: the last revision the server reported is sent as `If-Match`. On `REVISION_CONFLICT` the adapter re-reads the revision and retries once with the person's latest value; a second conflict surfaces as Could not save.
- Theme: `localStorage` keeps only a cache so the page paints in the right theme; the stored preference is the backend's. The header toggle saves best-effort and silently when signed out.
- Legal review: permission and location wording on these pages is not final.

---

# Persistence matrix

Which field the person types is saved where. One row per control. Another section below this one may be added by the profile and settings work; keep each section's rows in its own block.

## Tools, Compare, Stress, Review and Family (wire-tools)

Browser adapter `scenarios` and `members` (`src/adapters/scenarios.ts`) call the BFF; the BFF (`src/server/backend/scenarios.ts`, `members.ts`) validates, adds the session token and calls the backend. Saves are debounced 600 ms after the last change, one at a time, with the revision last seen as `If-Match`. A stale revision reloads the revision and sends the newest values once. The encoders are in `src/lib/scenario-codecs.ts`.

| Field (screen) | BFF route | Backend table | Status |
|---|---|---|---|
| 80D: regime, premium for self, premium for parents, parent 60 or older (Tools, 80D) | `PUT /api/app/scenarios?tool=tax` | `tool_scenarios` (`tax`: regime, premiumsPaid, deduction80d, ageBand) | wired |
| Room rent: cover, limit %, room per day, other charges (Tools, Room rent) | `PUT /api/app/scenarios?tool=hospital_bill` | `tool_scenarios` (`hospital_bill`: sumInsured, roomRentCap, roomRentActual, billAmount) | wired |
| Inflation planner: whose cover, treatment, rate, years (Money) | `PUT /api/app/scenarios?tool=inflation` | `tool_scenarios` (`inflation`: who, caseKind, medicalInflationPct, years) | wired |
| Compare: kind, scenario, six priority weights (Compare) | `PUT /api/app/scenarios?tool=compare_weights` | `tool_scenarios` (`compare_weights`: kind, scenario, weights) | wired |
| Compare: cover band (Rs 5L, 10L, 25L) | none | none | gap: the contract has no cover-band field (`ageBand` is a different thing) |
| Stress test: who, treatment, three levers (Stress test) | `PUT /api/app/scenarios?tool=stress_levers` | `tool_scenarios` (`stress_levers`: who, scenario, levers) | wired with two limits below |
| Review: accepted or changed decisions, checked or flagged items (Review) | `PUT /api/app/scenarios?tool=review_state` | `tool_scenarios` (`review_state`: items keyed `dec-n`, `look-n`) | wired |
| Family: add member name and relation (Add sheet) | `POST /api/app/members` | `household_members` | wired |
| Family: edit member name and relation (Edit sheet) | `PATCH /api/app/members?id=` (first save of a person with no stored member uses `POST`) | `household_members` | wired |
| Family: mobile, e-mail, invite channel (Add and Edit sheets) | none | none | gap: no backend field; stays on the mock adapter and is lost on refresh |
| Tools: top-up finder (who, cover, treatment, pick) | none | none | not wired: no scenario kind for it |
| Tools: advisor filter, slot, mode, shared items | none | none | not wired: booking is not a scenario |
| Premium rise (`premium_rise`) | `PUT /api/app/scenarios?tool=premium_rise` allowed by the BFF | `tool_scenarios` | route ready, no screen control uses it yet |

Limits of the stress encoding (no dedicated fields in `stress_levers`): add-a-top-up is stored as `sumInsuredPct` 100 or 200, cashless as `claimDelayDays` 0 or 14, room within the limit as `roomUpgrade` false or true. The "Dengue" treatment has no value in the `scenario` enum, so it is not stored and a reload shows the default treatment. `who` is the person's name because the screen has no member ids yet.

Scenario delete is not offered: the backend has no delete route for scenarios.
