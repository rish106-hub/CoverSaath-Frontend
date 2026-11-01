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
