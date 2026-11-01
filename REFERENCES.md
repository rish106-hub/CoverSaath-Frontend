# CoverSaath: reference designs and handoff pack (2026-11-01)

Owner rule: take **whole-layout** references (site structure, access/onboarding flow, app shell) from funded products in the same or adjacent industry, then adapt and add our own layer. Not single buttons. Not copy-paste. Do not copy brand assets, wording, logos or illustrations.

## 1. Sources studied

### 1a. Indian insurance players (fetched pages 2026-11-01)

| Product | Funding (sources vary; verify) | Why it matters |
| --- | --- | --- |
| Ditto, joinditto.in | Zerodha / Rainmatter backed; reports range Rs 4 cr seed to about Rs 34 cr in total ([inc42](https://inc42.com/company/ditto-insurance/funding/)); "advice-first" model | Closest consumer model: explain, compare, advise, claims support |
| Plum, plumhq.com | Series B about US$20M, led by Peak XV ([reinasia](https://reinasia.com/indian-insurtech-plum-raises-us20m-in-series-b-round-led-by-peak-xv-partners/)) | Group health cover, our persona's entry point; employee app |
| Insurance Samadhan, insurancesamadhan.com | Reported Rs 8.5 cr ([startuptalky](https://startuptalky.com/news/insurance-samadhan-raised-strategic-funding)) | Claim rejection and grievance help; Hindi toggle |
| Beshak, beshak.org | Not verified (fetch returned 429) | Insurance reviews and ratings; retry later |
| Onsurity | US$24M with IFC ([nextbillion](https://nextbillion.net/news/world-banks-ifc-backs-indian-insurtech-startup-onsurity-in-24-million-funding/)) | SME group health; not studied in depth |

**Ditto layout (top to bottom).**
- **Navigation.** A mega-menu split into Life and Health. Each half has Basics, Compare, Profile/Family, Benefits and Tools (calculators, renewal, claims, data lab).
- **Top of page.** Trust badges (Google rating, Zerodha) sit under the nav. The hero reads "Book a free call", with WhatsApp as the secondary action.
- **Product cards.** One for Term and one for Health, each carrying the same two CTAs.
- **Process.** A 3-step "Ditto Experience": expert call, end-to-end help, lifetime claim support.
- **Comparison.** A founder quote, then a table of Ditto against other platforms across Shortlisting, Application and Issuance.
- **Lower page.**
  - A CTA band.
  - Trust: a 4.9 rating and a review card.
  - Insurance checklists.
  - An FAQ accordion.
  - An **"Understand your policy" selector**: product → insurer → policy → check, with recent searches.
- **Footer.** Tools, 80C/80D pages, claims line, and the licence block.
- **Access.** A human call or WhatsApp. There is no account.

**Plum layout.**
- **Navigation.** Log in, Get a quote, and Product, Experience, Solutions and Explore menus. The menus include a testimonial card.
- **Upper page.**
  - The hero carries a quote form.
  - An awards band and three big stats (claims, lives, companies).
  - A logo strip.
  - Two "full-spectrum" cards: protection and care.
- **Product tour.** A tabbed showcase with an audience toggle: HR or employee. Each tab has screenshots.
  - For HR: enrolment, claims analytics, balance.
  - For employees: benefits with a claim button and PolicyGPT chat, teleconsult, and perks.
- **Lower page.**
  - Three onboarding steps.
  - Segment cards.
  - A testimonial carousel and a founders' letter.
  - Resource reports and a closing CTA.
  - A footer with security badges (ISO 27001, SOC 2) and the broker registration.
- **Access.** Get a quote. Log in leads to the app, and claims go to a separate claims site.

**Insurance Samadhan layout.**
- **Top bar.** A utility bar with phone, WhatsApp and a Hindi toggle. The nav has a "Register complaint" button.
- **Hero.** A banner with Register complaint and Call buttons, plus app links.
- **Problem tiles.** Nine question-style tiles, one per problem: mis-selling, rejection, short-settled, delay.
- **Trust.** Counters and a founder note. Then six service cards and app promo panels.
- **Intake process.** Five steps: reach out (name, email, phone) → share documents → case accepted → Rs 999 fee → 20% success fee.
- **Lower page.** Why us, video testimonials, a blog, Google reviews, media, and an FAQ with category tabs. A floating WhatsApp button and a fee calculator.

### 1b. Funded US/global products (Mobbin, web)

| Product | What to take | Mobbin |
| --- | --- | --- |
| **Origin** (AI family-finance app) | Full app shell, onboarding, advisor booking | [Home](https://mobbin.com/flows/e3be84de-257b-43a1-9d07-0d76216f404a), [Home 2](https://mobbin.com/flows/76c45437-6132-4da4-882f-134faad9bb2b), [Onboarding](https://mobbin.com/flows/9752139f-8301-44b6-afd5-1635345ec024), [Guide](https://mobbin.com/flows/2e18563f-8a0f-455a-a4ec-e5472788de31), [Browse advisors](https://mobbin.com/flows/f3a729dc-f5bb-4c84-991d-f54ddcfb8d77) |
| **Headspace** (therapy + insurance) | Insurance check to cost estimate, as a 3-stage stepper | [Verifying insurance](https://mobbin.com/flows/21fe61d2-00e0-4db3-8a31-be2d859151eb) |
| **Remote** | Benefits dashboard: things to do, quick actions, upcoming | [Benefits](https://mobbin.com/flows/7e32833f-09bc-4096-9c5e-c3e62bd8c1dc) |
| **Gusto** | Insurance hub inside an app: quick links, important dates, coverage cards, current policies, FAQ | [Business insurance](https://mobbin.com/flows/4df415c6-b3de-40ef-9e71-7016609e6baa), [Setting up insurance](https://mobbin.com/flows/30cf8302-da02-4fdf-8ac8-69cc96286a0e) |
| **Perplexity Health** (beta) | Beta dashboard: overview cards, guided workflows, connectors panel, bottom ask bar with voice | [screen](https://mobbin.com/screens/937419ce-bb2f-4187-a286-3328450562ff) |
| **Notion** | Request beta access as a modal | [Requesting access to Q&A](https://mobbin.com/flows/f81493ae-8b88-40f0-bdc7-7e32d5709469) |
| **Kajabi** | One-screen onboarding questionnaire with a progress bar | [Onboarding](https://mobbin.com/flows/8fe9c347-0e57-442a-8bde-53c5db4c1d2d) |
| **Airbnb** | Early-access confirmation pattern | [Early access](https://mobbin.com/flows/489158dd-ad52-42c5-ae8b-714fdb27293c) |
| **incident.io** | Split-screen access form, then an "All set" screen, then the dashboard | [Onboarding](https://mobbin.com/flows/1fa7c20d-6d4c-4c74-bd88-83aa8eee833b) |
| **Klook Protect** | Insurance quote and plan comparison modal | [Getting a quote](https://mobbin.com/flows/0886e96d-96a8-4ae1-933f-c12ff9b83486) |

**Origin, in detail.** This is the closest match to our premium bar.

- **Shell.**
  - Left rail grouped into TRACK (Home, Spending, Invest, Forecast) and SERVICES (Estate planning, Tax, Planner).
  - "Ask anything" pinned at the bottom of the rail.
  - Top bar: greeting, referral pill, + account, help, avatar.
- **Home.**
  - Main column: a net worth chart card with range chips, Spent this month as a calendar plus transactions, Investments, and a Favorites carousel.
  - Right column: a "Complete onboarding 1/6" card, a personal recap, budget, credit score and market watch.
- **Guide drawer.** A ring progress (1/6) and an accordion checklist: create budget, meet Sidekick, invite partner, refer, link accounts.
- **Advice.** A large serif headline, then an ask bar, then two rows of question chips. Expert session cards follow. The booking modal asks for priorities as chips, then shows a planner carousel.
- **Onboarding.** A split screen: form on the left, a dark visual with a product card on the right. Then "Where would you like to start?" with 5 options, then account linking.
- **Landing.** A full-bleed sky photo, a serif "Own your wealth.", one CTA, an ask bar under the hero, and award laurels.

**Headspace insurance flow.** A top stepper (Check in · Verify insurance · Schedule) sits above a 2-column layout: question on the left, card on the right. The steps run: provider search → member details → "Here's your estimated cost". The cost card is a big number with an "In-network" badge and "Things to know" bullets.

## 2. What we take, per CoverSaath screen (adapt, don't copy)

| Our screen | Layout reference | Our layer on top |
| --- | --- | --- |
| Landing | Origin landing (one strong headline, ask bar under the hero); Ditto section order (process steps, comparison, checklist, "understand your policy" selector, FAQ); Plum product tour (audience toggle: "For you" / "For your family" / "For HR") | Policy drop zone + live room-rent calculator in the page; marker highlights on real clauses; emergency band; **Get beta access** modal |
| Beta access | Notion request-access modal + Kajabi one-screen questionnaire + incident.io "All set" | Access granted on the site instantly; answers (who you look after, cover types, why) set up Home |
| Sign in / sign up | Origin split screen (form left, dark product visual right) | Google, Apple, phone OTP (WhatsApp fallback), email link, passkey; one button for both |
| Onboarding | Origin "where would you like to start" + Headspace stepper with 2-column question/card | DigiLocker / upload / forward HR mail / policy number; members detected from the schedule; first 3 answers with page refs |
| Home | Origin home (main column of chart cards + right column of onboarding ring, recap, nudges) + Remote things-to-do / quick actions / upcoming | Cover per person chart, "you'd pay" for a typical stay, needs-attention cards, calculators, dates, learn feed matched to the user's clauses |
| Guide | Origin guide drawer (ring 1/6 + accordion) | Add policy, add family, save e-card, run 80D, try stress test, meet the assistant |
| Policy / stress test | Headspace "estimated cost" card + Klook plan comparison | Scenario chips, insurer pays vs you pay bar, sub-limit / co-pay rows with page refs, ways to pay less, pros and cons |
| Compare | Ditto comparison table + Klook comparison modal | Section-by-section against plans in the same cover band; top-ups; best-fit card; advisor partner |
| Advice / assistant | Origin Advice (serif headline, ask bar, question chips, expert sessions); Perplexity Health workflows and connectors; Plum PolicyGPT | Voice orb, Hindi/English, intent classifier that navigates; plain-language helper on every term |
| Claims help | Insurance Samadhan problem tiles + 5-step intake; Ditto lifetime claim support | "Claim cut short?": a tile grid feeding an intake with documents, linked to the clause; Bima Bharosa link |
| Emergency | (no direct parallel: our own) | E-card, 112/108, cashless hospitals map, blood stock by group (e-RaktKosh), desk checklist, share location |
| Footer / trust | Plum footer (security badges, registration) | AES-256 encryption, data controls; licence block once registered |

## 3. Where everything is

- **Product spec:** `CoverSaath frontend/PRODUCT.md`
  - ICPs, drop-off reasons, IA, flows F1–F6.
  - Assistant intents, official integrations, backend gaps B1–B7 (plus B8 beta access), metrics, build order.
- **v1 research:** `CoverSaath frontend/RESEARCH.md`.
- **Design board v3:** https://claude.ai/artifact/LBT5qoxtpohgPioZzhMJc9
  - Source files: `/private/tmp/claude-502/-Users-rishavdewan-Developer-Product-experiments-CoverSaath/bfa6d1fb-2dc9-4846-af81-3eaa8d207607/scratchpad/canvas/project/*.dc.html`. This folder is temporary; copy it into the frontend repo `design/` before the session ends.
  - Artboards: Main, Landing, Auth, Onboarding, Home, Policy, Compare, Emergency, Assistant, Tools, Reading, Family.
- **Design system v2:**
  - Colours: Paper #F7F5F0, Ink #16130F, Harbour #0E4F4A, Sea glass #6FA79E, Marker #F4DC8A, Ochre #E3B85A, Signal #E9785D, Coral #F2B9A8.
  - Fonts: Newsreader (headlines and numbers), Geist (UI), Geist Mono (page refs).
- **Invented names on the board, kept on purpose:** Northstar Health, Kaveri General, Meridian Care, Indus Shield Health, and the hospitals and blood banks. Real names would pair real organisations with made-up numbers. Use logo **slots** until permission is granted.
- **BFF to reuse:** `Knowvia_website` branch `feat/ui-app` (sealed cookies, CSRF, server-side calls to the API).

## 4. Rules for the next agent

1. **Copy:** no defensive copy anywhere: no sample, demo, preview, draft, "not advice" or "not an insurer" labels. No invented user counts, ratings, testimonials, awards or partner logos.
2. **Layout:** laptop-first at 1440, fluid down to 390. Cards, charts and calculators. Nothing longer than two lines.
3. **Evidence:** every answer shows its page and line.
4. **Browser boundary:** the API is called server-side only (BFF), never from the browser.
5. **Stack:** Next.js app in this repo; reuse the BFF.
6. **Build order:**
   1. Landing + beta access + auth + onboarding.
   2. Home + calculators + glossary.
   3. Emergency.
   4. Stress test, compare, learn.
   5. Assistant.
7. **Backend gaps are separate tasks** in `../CoverSaath`. See jtbd.md section 19.
