# CoverSaath: product spec (v3)

Design board: https://claude.ai/artifact/LBT5qoxtpohgPioZzhMJc9
Backend: `../CoverSaath` (API, BFF pattern). Landing site: `../Knowvia_website`. This folder is its own repo.

## 1. Who we build for

| | Aarav, 23 | Meera, 41 |
| --- | --- | --- |
| Life | First job, Bengaluru, lives with flatmates | Manager, spouse Rohan, son Kabir (8), parents in Pune; father diabetic |
| Cover | Employer group cover Rs 5L | Group floater Rs 5L + personal top-up Rs 10L + parents' senior plan Rs 3L each |
| Knows | Nothing. Has never opened the PDF | The basics, never the clauses. Has been surprised at a hospital desk |
| Opens us because | HR mail, a parent asked, tax proofs due, switching jobs | Father's admission, renewal reminder, a claim cut short, tax proofs |
| Device | Laptop at work, phone at night | Laptop at work, phone in a hospital corridor |
| Wants in 10 s | "Am I covered, how much, what do I do" | "Who in my family is covered by what, and what will I pay" |

Bar: the polish of a Silicon Valley product made for educated American users, carrying Indian insurance knowledge.

## 2. Why people drop off, and the answer

| In their head | Answer on screen |
| --- | --- |
| "Too much jargon" | Every term has a dotted underline: tap for a one-line meaning plus what *your* policy says. The assistant can explain any screen out loud. |
| "This will take forever" | Value before sign-up: drop a PDF on the landing page, see three answers, then save with Google. Onboarding is 3 steps, under 2 minutes. |
| "What do I get right now?" | Home opens on numbers and cards: cover per person, what you'd pay in a common stay, dates coming up, one thing to fix. |
| "Is my data safe?" | One-line consent, per-person sharing, encryption at rest. Plain words, one place. |
| "They'll sell me something" | Recommendations are explained with the clause and the numbers; partners are labelled as partners. |
| "I'll do it later" | Moments that bring people back: tax season (80D), renewal dates, job switch, a hospital visit. |

## 3. Principles

1. Numbers, cards and charts first. No paragraph longer than two lines on any app screen.
2. Every answer points to the page and line it came from (the document is the interface).
3. Type, talk or tap: the ask bar and voice orb sit on every screen.
4. Emergency is one tap from anywhere, works on a phone with one hand, dark, big targets.
5. One primary action per card.
6. Laptop-first layouts (1440 / 1280), fluid down to 390.

## 4. Information architecture

Public: Landing · Sign in / Sign up (one screen) · Help · Legal.
Onboarding: Add policy → Who is covered → Your first answers.
App (left rail): Home · My policies · Stress test · Compare · Calculators · Learn · Family · Emergency (red, pinned) · Settings.
Global: Ask bar (⌘K) · Voice orb · Glossary popovers · Notifications.

## 5. Key flows

**F1 First visit (Aarav).** Landing → drop PDF or "Fetch from DigiLocker" → one consent line → three answers appear on the page (cover, room limit, what you'd pay for a 3-night stay) → "Save with Google" → Home.
**F2 Family set-up (Meera).** Home → "Add a person" → name + relation → "Add their policy" (DigiLocker / upload / forward HR mail) → people × policies grid fills.
**F3 Hospital tonight.** Any screen → Emergency → pick person → e-card, nearest cashless hospitals, call 112/108, blood availability, 4-step desk checklist, share location with family.
**F4 Tax season.** Notification "Tax proofs due" → 80D calculator pre-filled from premiums on file → download summary.
**F5 Should I buy a top-up?** Stress test shows gap on a big claim → Compare top-ups by section → talk to an advisor partner or open the insurer page.
**F6 Voice.** Hold orb → "my father has chest pain" → classifier: `emergency` (instant, rule-based) → Emergency for Father. "What is co-pay" → `explain_term` → popover + spoken answer.

## 6. Feature list

| Area | Feature | Build source |
| --- | --- | --- |
| Landing | Drop zone, live room-rent mini calculator, bill chart, bento feature cards, emergency strip, 3-step how it works | Board 01 |
| Auth | Google, phone OTP, email link, passkey; one screen for sign in and sign up; guest → account linking | Board 02 |
| Onboarding | 3 steps, auto-detected members from the schedule, insurer logo slot | Board 03 |
| Home | Cover per person bar chart, "needs attention" cards, dates timeline, quick calculators, feed | Board 04 |
| Policy | Section scores, pros and cons, clause reader with highlights | Boards 05, Reading |
| Stress test / scenarios | Pick procedure, city, room, person → insurer pays vs you pay; optimizer tips; "with top-up" toggle | Board 06 |
| Compare | Section-by-section across insurers in the same cover band, top-ups, advisor partner card | Board 07 |
| Calculators | 80D, room rent, co-pay, top-up deductible, job-switch cover end | Board Tools |
| Learn | News, our guides, videos matched to the clauses in your policy | Board 04 feed |
| Emergency | E-card, cashless hospitals near you, 112/108, blood stock by group, desk checklist, family share | Board 08 |
| Assistant | Voice + text, intent classifier, navigation, term explainer, follow-up chips | Board 09 |

## 7. Assistant: intents

| Intent | Example | Routing |
| --- | --- | --- |
| `emergency` | "father chest pain", "admit", "ICU", "blood" | Rule-based keywords first, no model wait. Opens Emergency for the named person. |
| `explain_term` | "what is co-pay" | Glossary lookup, then policy clause if present |
| `ask_policy` | "is cataract covered for mom" | Backend evidence answer with page reference |
| `calculate` | "how much tax can I save" | Opens the calculator, pre-filled |
| `compare` | "is my top-up good" | Compare, filtered |
| `add_document` | "add my wife's policy" | Upload / DigiLocker sheet |
| `family` | "who is covered" | Family grid |
| `navigate` | "settings", "renewal" | Route change |

Classifier: rules + small local model for the first pass; a hosted model only when confidence < 0.7, behind the privacy gate. Speech: browser Web Speech API now; Indian-language speech provider later (paid, needs approval).

## 8. Integrations (placeholders until access is granted)

| Need | Source | Status and route to access |
| --- | --- | --- |
| Fetch policy | [DigiLocker](https://www.digilocker.gov.in) issued documents; insurers were told by IRDAI (Feb 2021) to issue policies there | Requester onboarding with NeGD/MeitY. Until then: upload, HR-mail forward |
| Health ID, records | ABDM / ABHA, [Health Facility Registry](https://facility.abdm.gov.in) | Sandbox registration; HFR search API for hospitals |
| Blood stock | [e-RaktKosh](https://eraktkosh.mohfw.gov.in) (CDAC) | No open API; request via CDAC (eraktkosh@cdac.in). Until then: deep link by state/district |
| Government APIs | [API Setu](https://directory.apisetu.gov.in) | Browse catalogue for health and insurance APIs; partner sign-up |
| Network hospitals | Insurer and TPA network lists, Google Places for distance | Per-insurer files; Places API key (paid) |
| Ambulance | 112 / 108 dial links | Live |
| Grievance | IRDAI Bima Bharosa | Link out |
| Marketplace | IRDAI Bima Sugam (health later than motor) | Watch |
| Advisors / top-ups | Ditto, comparison sites | Partnership. Referral payouts need an IRDAI-compliant arrangement: decide before launch |
| Videos | YouTube Data API v3 (search by clause topic) | API key, free quota |
| News | News search API or curated RSS, filtered by insurer and topic | Pick provider |
| Logos | Insurer and partner logos | Slot per insurer; use only with permission |

## 9. Backend gaps (CoverSaath API)

1. Real sign-in routes (Google OAuth, phone OTP, email link) on top of `auth_identities` (migration 017).
2. Guest household → signed-in adult linking.
3. Member invites and per-person sharing.
4. People ↔ policy mapping endpoint.
5. Scenario / stress-test endpoint (deterministic rules over extracted facts).
6. Hospital and blood lookups via server-side adapters (no browser calls; BFF only).
7. Assistant endpoint: intent classify + route, with the privacy gate.

## 10. Metrics

Activation: first answer within 3 minutes of landing. Save rate: answers seen → account. Family depth: people added per account. Return: D7 / D30, tax-season and renewal returns. Emergency readiness: e-card saved to phone.

## 11. Build order

1. Next.js app in this repo, BFF reused from `Knowvia_website` `feat/ui-app`.
2. Landing + auth + onboarding (F1).
3. Home + calculators + glossary.
4. Emergency (F3).
5. Stress test, compare, learn.
6. Voice assistant.
