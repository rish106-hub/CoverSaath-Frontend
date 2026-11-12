import { pageFor } from "@/lib/ia";

/** What Ask Knowvia knows about the page the person is on. Copied from each board's `__voice()` data. */
export type VoiceExample = { say: string; steps: [string, string, string]; goHref?: string; goLabel?: string };
export type PageContext = { route: string; page: string; reads: string; examples: [VoiceExample, VoiceExample, VoiceExample] };

const ex = (say: string, steps: [string, string, string], goHref?: string, goLabel?: string): VoiceExample => ({ say, steps, goHref, goLabel });

/** Registry keyed by route pattern (see src/lib/ia.ts). Append-only: add new routes at the end. */
export const PAGE_CONTEXT: Record<string, PageContext> = {
  "/home": { route: "/home", page: "Home", reads: "your 3 policies and this page", examples: [
    ex("Is Mumma’s cataract covered?", ["Mother · cover question", "Read senior plan p.14", "Yes, up to Rs 40,000 per eye"], "/policies/meridian-senior", "Open the clause"),
    ex("Take up Papa’s short claim", ["Father · claim help", "Opened a Desk case", "Sent documents to the TPA"], "/desk", "See the case"),
    ex("Papa ko chest pain hai", ["Emergency · Father", "Nearest cashless: 2.1 km", "Calling ahead with his e-card"], "/emergency", "Go to Emergency"),
  ] },
  "/assistant": { route: "/assistant", page: "Ask Knowvia", reads: "everything you have shared", examples: [
    ex("What can you do for me?", ["Help", "Read policies, track claims, find hospitals", "Just say it"]),
    ex("Show my open cases", ["Desk", "5 open, 1 needs you", "Opening Desk"], "/desk", "Go to Desk"),
    ex("Is Rohan on the top-up?", ["Rohan · top-up", "Checked Kaveri member list", "No, add him for about Rs 2,100 a year"]),
  ] },
  "/compare": { route: "/compare", page: "Compare plans", reads: "the 4 plans and your priorities", examples: [
    ex("Which plan is best for my parents?", ["Compare · parents", "Weighed co-pay and room rent", "Recommended plan scores 86%"]),
    ex("Make no co-pay my top priority", ["Priority · co-pay", "Set to High", "Scores updated"]),
    ex("Talk to an advisor about this", ["Advisor", "Found 3 registered advisors", "Earliest call: today 6 pm"], "/tools", "See advisors"),
  ] },
  "/review": { route: "/review", page: "Things to check", reads: "the open decisions on this page", examples: [
    ex("Accept everything you recommend", ["6 recommendations", "Accepted all six", "Nothing left that needs you"]),
    ex("Why do you need my Gmail?", ["Question · Gmail", "Used only to find receipts", "You can revoke it any time"], "/money", "See what it found"),
    ex("Take me home", ["Navigate", "Saving your choices", "Opening Home"], "/home", "Go to Home"),
  ] },
  "/desk": { route: "/desk", page: "Claims and insurer talks", reads: "5 open cases with insurers and TPAs", examples: [
    ex("What is happening with Papa’s claim?", ["Case · short claim", "TPA reopened it Monday", "Decision expected Tuesday"]),
    ex("Escalate it", ["Escalation", "Grievance officer is next", "Drafted the email for you"]),
    ex("What do I need to sign?", ["Needs you · 1", "Claim form, one signature", "Opening it now"]),
  ] },
  "/family": { route: "/family", page: "My family", reads: "5 people and who is on which policy", examples: [
    ex("Add my sister Priya", ["Family · new member", "Name and mobile needed", "Opening the add sheet"]),
    ex("Who is not covered for OPD?", ["Gaps · OPD", "Checked 3 policies", "Rohan and Kabir"]),
    ex("Send Father’s e-card to Rohan", ["Father · e-card", "Found the card", "Sent to Rohan on WhatsApp"], "/cards", "Open cards"),
  ] },
  "/emergency": { route: "/emergency", page: "Emergency", reads: "hospitals near you and Father’s e-card", examples: [
    ex("Nearest cashless hospital", ["Hospitals · 5 km", "Found 4 cashless", "Closest: 2.1 km, 7 min"]),
    ex("Call the hospital ahead", ["Call · front desk", "Sharing Father’s e-card", "Calling now"]),
    ex("Tell Rohan we are going", ["Family · Rohan", "Shared live location", "Sent on WhatsApp"]),
  ] },
  "/money": { route: "/money", page: "Money desk", reads: "your receipts, renewals and refunds", examples: [
    ex("How much can I claim under 80D?", ["Tax · 80D", "Matched 4 receipts", "Rs 75,000 this year"]),
    ex("Will Rs 3L be enough in 10 years?", ["Plan · inflation 12%", "Bypass Rs 6.5L becomes about Rs 20L", "Raise parents’ cover before 2028"]),
    ex("Where is my refund?", ["Refund · duplicate premium", "With the insurer since Monday", "Expected Friday"], "/desk", "See the case"),
  ] },
  "/stress-test": { route: "/stress-test", page: "Stress test", reads: "Northstar group policy, 42 pages", examples: [
    ex("What if Papa needs a bypass?", ["Scenario · bypass · Father", "Bill Rs 6.5L vs cover Rs 3L", "You would pay about Rs 3.9L"]),
    ex("What does page 9 say about room rent?", ["Policy · p.9", "Room rent capped at 1% of cover", "Rs 5,000 a day for you"], "/policies/northstar-floater", "Open page 9"),
    ex("How do I close this gap?", ["Gap · parents", "A Rs 10L super top-up covers it", "About Rs 9,800 a year"], "/tools", "See top-ups"),
  ] },
  "/tools": { route: "/tools", page: "Calculators and top-ups", reads: "calculators, top-ups and advisors", examples: [
    ex("Find a top-up for my parents", ["Top-up · parents", "Checked 6 plans", "Best fit: Rs 10L, deductible Rs 3L"]),
    ex("Book a registered advisor", ["Advisor", "IRDAI-registered, 3 near you", "Earliest call: today 6 pm"]),
    ex("Test my cover against a big bill", ["Stress test", "Loading your family", "Opening the stress test"], "/stress-test", "Open stress test"),
  ] },
  "/cards": { route: "/cards", page: "Cards and wallet", reads: "your saved policy cards", examples: [
    ex("Add Papa’s card to my wallet", ["Wallet · Father", "Detected Apple Wallet", "Card added"]),
    ex("Share Mumma’s card with Rohan", ["Share · Mother", "Picked WhatsApp", "Sent"]),
    ex("Which card do I show at the hospital?", ["Hospital · cashless", "Use Northstar for you, Meridian for parents", "Both are in your wallet"]),
  ] },
  "/policies/[id]": { route: "/policies/[id]", page: "Policy reader", reads: "the policy open on this page", examples: [
    ex("Explain this page in simple words", ["Reading · this page", "Summarised 3 clauses", "Room rent, co-pay, waiting period"]),
    ex("Where does it say maternity?", ["Search · maternity", "Found on p.17 and p.31", "Covered after 9 months"]),
    ex("Compare this with Papa’s plan", ["Compare · 2 policies", "Lined up 12 sections", "Opening the comparison"], "/compare", "Open Compare"),
  ] },
  "/welcome": { route: "/welcome", page: "Getting started", reads: "what you have added so far", examples: [
    ex("I can’t find my policy", ["Find policy", "Can check Gmail or DigiLocker", "Pick one to start"]),
    ex("My employer gives me insurance", ["Group cover", "Ask HR for the e-card", "Or forward the HR email"]),
    ex("Skip this for now", ["Navigate", "Saved your progress", "Opening Home"], "/home", "Go to Home"),
  ] },
  // Routes without a board `__voice()` block: examples written to match the page headings in src/lib/ia.ts.
  "/policies": { route: "/policies", page: "My policies", reads: "your 3 policies and who they cover", examples: [
    ex("Which policy covers Mumma?", ["Mother · policy", "Checked 3 policies", "Meridian Care senior plan, Rs 3L"], "/policies/meridian-senior", "Open the policy"),
    ex("When does each policy renew?", ["Renewals", "Read 3 policy dates", "Meridian 13 Mar, Northstar 31 Mar, Kaveri 14 Jun"], "/money", "See what is coming up"),
    ex("Add another policy", ["Add policy", "Can read a PDF or Gmail", "Opening the add step"], "/welcome/add", "Add a policy"),
  ] },
  "/shortcuts": { route: "/shortcuts", page: "Shortcuts", reads: "the keys, mouse and voice ways to move", examples: [
    ex("What does G then H do?", ["Shortcut · G H", "Go to Home", "Works when no field is open"]),
    ex("How do I talk to you?", ["Voice", "Hold V and speak", "Release to send"]),
    ex("Take me home", ["Navigate", "Opening Home", "Done"], "/home", "Go to Home"),
  ] },
  "/settings": { route: "/settings", page: "Settings", reads: "your connected sources and account", examples: [
    ex("What have I connected?", ["Connected sources", "Gmail for receipts", "You can revoke it any time"]),
    ex("Switch to dark mode", ["Theme", "Dark selected", "Press T to switch back"]),
    ex("Take me home", ["Navigate", "Opening Home", "Done"], "/home", "Go to Home"),
  ] },
  "/profile": { route: "/profile", page: "Your profile", reads: "your contact details, address and location choices", examples: [
    ex("Add my address", ["Profile · address", "DigiLocker or typed by you", "Opening the address section"]),
    ex("Why do you need my location?", ["Question · location", "Finds hospitals near you", "Kept 24 hours at about 1 km"]),
    ex("Take me home", ["Navigate", "Opening Home", "Done"], "/home", "Go to Home"),
  ] },
  // Cover screens (S-B2).
  "/covers/add": { route: "/covers/add", page: "Add a cover", reads: "the policy schedule and terms and conditions you add, and the plan guesses", examples: [
    ex("Add my health policy", ["Add a cover", "Choose the type, then the schedule and the terms and conditions", "We read them and guess the plan"]),
    ex("It picked the wrong plan", ["Plan choice", "Choose Something else", "Search by insurer or plan name"]),
    ex("How big can the file be?", ["Add a cover", "Up to 4 MB, PDF only", "Larger files are not taken here yet"]),
  ] },
  "/covers/declarations": { route: "/covers/declarations", page: "Declarations and money", reads: "what you declared and the premium you paid", examples: [
    ex("Add Papa’s diabetes", ["Declaration", "Choose Papa and the kind", "Saved, sealed"]),
    ex("Record my premium", ["Premium", "Amount, date and how", "Saved against this cover"]),
    ex("Can I skip this?", ["Skip", "Yes, come back any time", "Opening the review"], "/covers/review", "Go to the review"),
  ] },
  "/covers/review": { route: "/covers/review", page: "What we found", reads: "the facts read from your policy and any conflicts", examples: [
    ex("What needs my decision?", ["Conflicts", "Two readings differ", "You choose which is right"]),
    ex("What is the waiting period?", ["Waiting", "Read from your document", "Shown with the page it came from"]),
    ex("Add my declarations", ["Declarations", "Health details and premium", "Opening Declarations and money"], "/covers/declarations", "Open declarations"),
  ] },
  // Chat and hospitals (S-C1).
  "/chat": { route: "/chat", page: "Ask about your cover", reads: "your cover facts and the insurer's wording", examples: [
    ex("Is my planned knee surgery covered?", ["Cover question", "Checked waiting period and limits", "Answer with the facts used"]),
    ex("What are my waiting periods?", ["Waiting", "Read from your document", "Shown with where each came from"]),
    ex("Find cashless hospitals", ["Hospitals", "Search by pincode", "Opening Network hospitals"], "/hospitals", "Open network hospitals"),
  ] },
  "/hospitals": { route: "/hospitals", page: "Network hospitals", reads: "the hospitals in your cover's network", examples: [
    ex("Hospitals near 400053", ["Hospitals", "Search by pincode", "Network hospitals listed"]),
    ex("Is it cashless there?", ["Cashless", "Shown on each hospital", "Ask about your cover for more"], "/chat", "Ask about your cover"),
    ex("Ask about my cover", ["Question", "Opening the chat", "Ask in your own words"], "/chat", "Open the chat"),
  ] },
  // Public screens.
  "/": { route: "/", page: "Beta access", reads: "the Knowvia beta page", examples: [
    ex("What does Knowvia do?", ["Question · Knowvia", "Reads your policy, shows what you would pay", "Then handles the follow-up"]),
    ex("Is it free?", ["Question · price", "Free while in beta", "No card needed"]),
    ex("How do I get access?", ["Access", "Use Google, or your name and email", "Takes under a minute"]),
  ] },
  "/signin": { route: "/signin", page: "Sign in", reads: "the sign-in page", examples: [
    ex("I didn’t get the code", ["Sign in · code", "Codes can take a minute", "You can resend or use email instead"]),
    ex("Sign in with email instead", ["Sign in · email", "Sends a link to your inbox", "Open it on this device"]),
    ex("Is my data safe?", ["Question · privacy", "Only what you share is read", "You can revoke any source"]),
  ] },
};

/** Resolve a pathname to its context (dynamic routes and /welcome/* included). */
export function contextFor(pathname: string): PageContext {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return PAGE_CONTEXT["/"];
  if (clean === "/signin") return PAGE_CONTEXT["/signin"];
  if (clean.startsWith("/welcome")) return PAGE_CONTEXT["/welcome"];
  const def = pageFor(clean);
  return PAGE_CONTEXT[def?.route ?? clean] ?? PAGE_CONTEXT["/assistant"];
}
