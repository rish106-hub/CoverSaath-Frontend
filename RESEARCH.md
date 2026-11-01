# CoverSaath frontend: research and approach

Design board (brief and clickable prototype): https://claude.ai/artifact/LBT5qoxtpohgPioZzhMJc9

## What the product is
A consent-first reader for Indian health insurance documents. The user adds an e-card or policy PDF. The backend reads it only with permission and returns the limits that decide a hospital bill: cover amount, room rent, co-payment, waiting periods, pre-authorisation and policy dates. Each value comes with its page and a quote.

It is not an insurer or a broker. It gives no score and makes no claim decision. When it has not found something, it says "not found yet".

## Personas
- **A, "Aarav", 23.** First job, one company group cover, zero insurance knowledge. Installed the app because HR asked him to.
- **B, "Meera", 41.** Herself, spouse and child on the company cover, plus a personal top-up. Her parents are on their own senior plan and one parent is unwell. She needs per-person answers and must know where the documents disagree.

## Convenience rules
1. Value in 60 seconds.
2. One question per screen.
3. Organise by people, not policies.
4. Hospital mode is one tap away.
5. Every number shows its page.
6. Both permissions on one sheet, nothing pre-ticked.
7. The user can close the app and come back; reading continues.
8. No verdicts.

## References (why shortlisted, what we take)
| Reference | Use as | Why | Take |
|---|---|---|---|
| [Alan home (Mobbin)](https://mobbin.com/screens/421c6019-fb03-484a-889e-274e60eca205) | Case study | Employee insurer app. Home has three tiles: Send a document, See my coverage, Hospital stay | Action tiles, hospital entry, card on top |
| [Alan add family member (Mobbin)](https://mobbin.com/flows/8fdfedbf-5115-4e9f-ae14-1c7cdf235352) | Research | One question per screen; family listed by person | Per-person family list |
| [Zocdoc upload insurance card (Mobbin)](https://mobbin.com/flows/969c9287-bd59-4ea0-8ba0-4a42fc082705) | Experiment | Photo, crop, done | Take photo / Upload as the only actions |
| [Zocdoc onboarding (Mobbin)](https://mobbin.com/flows/a39e9def-e888-4663-a597-f2abc49c5d29) | Research | Google sign-in first; insurance added later | Social sign-in first |
| [Acko policy analyser](https://www.acko.com/health-insurance/policy-analyser) | Case study | Closest Indian competitor: policy PDF in, room rent and waiting periods out | Benchmark; beat it with page quotes and the family view |
| [Beshak decoder](https://beshak.org/insurance/health-insurance/health-insurance-plans/reviews) | Research | Indian policy jargon explained in plain words | Vocabulary, topic order |
| [Ditto](https://joinditto.in) | Research | Calm, trusted advisory tone | Non-selling tone |
| [Plum](https://www.plumhq.com) | Case study | Indian employee health app; family e-cards, sharing | Family e-cards, share a card |
| [Onsurity](https://www.onsurity.com/compare/best-employee-health-insurance-platforms-india) | Experiment | E-cards, claim status, WhatsApp bot | WhatsApp hospital card (later) |
| [Nayya](https://nayya.com/get-nayya) | Research | Same customer (employees), US market; guided questions | Guided questions, employer as the channel |
| [Oscar](https://www.hioscar.com/about) | Research | Rewrites plan documents in plain language | Plain rewrite with the source one tap away |
| [Lemonade coverage (Mobbin)](https://mobbin.com/screens/1afd1a30-a647-458c-9365-3ee1379aded3) | Experiment | Footer: "Summary only. Read your Policy" | Honest footer |
| [Monzo what's covered (Mobbin)](https://mobbin.com/screens/fb745d43-b066-43d1-8289-0fde83eed7fb) | Experiment | Short plain cards for what is and is not covered | Topic cards |
| [GoPay plan benefits (Mobbin)](https://mobbin.com/screens/e53032b8-db35-4e67-92d5-8c5e1b11828c) | Research | Co-payment banner; room limit per day | Co-payment caution |
| [Wise upload (Mobbin)](https://mobbin.com/screens/a4810e56-b3ae-4d50-a0fd-917c3d0e350f) | Experiment | Three-step explainer plus an AI-can-be-wrong note | Honest upload screen |
| [CRED insurance (Mobbin)](https://mobbin.com/screens/f65ff158-d1e4-432e-aa31-c39cc23b3eb2) | Research | Indian fintech polish; nudges when a document is missing | Nudge; avoid its "well protected" verdict |
| [Monarch household (Mobbin)](https://mobbin.com/screens/b38d5b78-cc18-4260-951c-d21e69adc40b) | Research | Household members and adviser access | Who sees what, per adult |
| Knowvia landing (local repo) | Research | Our promise: plain words, the exact page | Tone, colours, type |

## Build plan
1. Next.js app in this folder. Copy the tested BFF layer from `Knowvia_website` branch `feat/ui-app`: `src/server/app`, `src/app/api/app`, the session, OIDC and CSRF code, and its tests. Rebuild every screen from the board.
2. Screens, in journey order: welcome, who to look at, add cover, permission sheet, reading, home, topic detail, hospital mode, person view, permissions.
3. Backend gaps go to the backend agent: family members per household, which policy covers which person, profile answers (run E1) and stored events.
4. Prove it in a browser with test PDFs through the real routes.
5. Later: forward the HR email to add documents, a WhatsApp hospital card, share a card with family.

