// Home overview data (board Home). All people, insurers and numbers are invented.

export type Stat = { prefix?: string; value: number; decimals?: number; suffix?: string; group?: boolean };

export const healthScore = 72;
export const healthGaps = [
  { t: "Rohan not on the top-up", p: 8, href: "/compare" },
  { t: "Parents’ cover is Rs 3L each", p: 6, href: "/tools" },
  { t: "Room rent: pages disagree", p: 4, href: "/policies" },
];

export type GlanceTile = {
  icon: string; label: string; stat?: Stat; text?: string; detail: string; progress: number; href: string; tone: "plain" | "light" | "marker";
};
export const glanceTiles: GlanceTile[] = [
  { icon: "◎", label: "Total cover", stat: { prefix: "Rs ", value: 23, suffix: "L" }, detail: "Across 3 policies, 5 people", progress: 100, href: "/policies", tone: "light" },
  { icon: "◔", label: "Cover left this year", stat: { prefix: "Rs ", value: 21.5, decimals: 1, suffix: "L" }, detail: "Rs 1.48L used, for Father", progress: 93, href: "/stress-test", tone: "plain" },
  { icon: "₹", label: "Premium a month", stat: { prefix: "Rs ", value: 5308, group: true }, detail: "Rs 63,700 a year, all policies", progress: 0, href: "/money", tone: "plain" },
  { icon: "⇆", label: "Claims this year", text: "1 open", detail: "2 settled · Rs 58,240 recovered", progress: 66, href: "/desk", tone: "plain" },
  { icon: "↻", label: "Next renewal", text: "13 Mar", detail: "Parents’ plan · in 132 days", progress: 64, href: "/compare", tone: "plain" },
  { icon: "%", label: "Tax you can save", stat: { prefix: "Rs ", value: 75000, group: true }, detail: "Under 80D · proofs due Jan", progress: 0, href: "/tools", tone: "marker" },
];

export const alerts = [
  { t: "Father’s room rent: documents disagree", d: "Schedule says Rs 3,000/day, wording says 1% of cover.", cta: "See both pages", href: "/policies", c: "var(--signal)" },
  { t: "Rohan isn’t on your top-up", d: "A bill over Rs 5L for him is not covered.", cta: "Compare top-ups", href: "/compare", c: "var(--ochre)" },
  { t: "Your group cover ends with your job", d: "Plan a personal base policy before you switch.", cta: "Check dates", href: "/tools", c: "var(--sea-glass)" },
];

export const monthStrip = ["NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT"];
export const yearTiles = [
  { m: "JAN", d: "15", in: "75 days", t: "Tax proofs to HR", s: "Rs 75,000 under 80D, pack ready", cta: "Download pack", href: "/tools", band: "var(--marker)" },
  { m: "MAR", d: "13", in: "132 days", t: "Parents’ plan renews", s: "Meridian Care · compare first", cta: "Compare", href: "/compare", band: "var(--coral)" },
  { m: "MAR", d: "31", in: "150 days", t: "Group cover year ends", s: "Northstar · employer renews", cta: "See what changes", href: "/tools", band: "var(--mist)" },
  { m: "JUN", d: "14", in: "225 days", t: "Top-up renews", s: "Kaveri · auto-debit on", cta: "Check debit", href: "/money", band: "var(--mist)" },
];

export const policyCards = [
  { icon: "◫", type: "Group cover", ins: "Northstar Health · via your employer", mark: "NH", cover: "Rs 5L", pm: "Rs 0", used: "Rs 0", up: 0, who: "Meera, Rohan, Kabir", ren: "31 Mar", c: "var(--harbour)", ink: "var(--on-harbour)" },
  { icon: "↗", type: "Super top-up", ins: "Kaveri General · after Rs 5L", mark: "KG", cover: "Rs 10L", pm: "Rs 658", used: "Rs 0", up: 0, who: "Meera only", ren: "14 Jun", c: "var(--sea-glass)", ink: "#16130f" },
  { icon: "♥", type: "Parents’ plan", ins: "Meridian Care · senior", mark: "MC", cover: "Rs 3L each", pm: "Rs 4,650", used: "Rs 1.48L", up: 49, who: "Mother, Father", ren: "13 Mar", c: "var(--ochre)", ink: "#16130f" },
];

export type PersonBar = { name: string; rel: string; group: number; topup: number; senior: number; amount: string; share: string; groupPct: number; topupPct: number; seniorPct: number };
export const personBars: PersonBar[] = [
  { name: "Meera", rel: "You", group: 33, topup: 67, senior: 0, amount: "Rs 15L", share: "100%", groupPct: 50, topupPct: 50, seniorPct: 0 },
  { name: "Rohan", rel: "Spouse", group: 33, topup: 0, senior: 0, amount: "Rs 5L", share: "50%", groupPct: 50, topupPct: 0, seniorPct: 0 },
  { name: "Kabir", rel: "Son", group: 33, topup: 0, senior: 0, amount: "Rs 5L", share: "50%", groupPct: 50, topupPct: 0, seniorPct: 0 },
  { name: "Mother", rel: "Parent", group: 0, topup: 0, senior: 20, amount: "Rs 3L", share: "24%", groupPct: 0, topupPct: 0, seniorPct: 24 },
  { name: "Father", rel: "Parent", group: 0, topup: 0, senior: 20, amount: "Rs 3L", share: "24%", groupPct: 0, topupPct: 0, seniorPct: 24 },
];

export const claims = [
  { icon: "⇆", t: "Father · Kothrud Care, Aug", d: "Bill Rs 1.9L · paid Rs 1.48L · Rs 41,800 taken up", s: "Open", tone: "marker" },
  { icon: "✓", t: "Mother · cataract pre-approval", d: "Rs 55,000 approved, cashless", s: "Approved", tone: "harbour" },
  { icon: "✓", t: "Mother · pharmacy bill", d: "Rs 3,240 paid to your bank", s: "Paid", tone: "mist" },
] as const;
export const claimsLeft = [
  { k: "Father’s cover left", v: "Rs 1.52L" },
  { k: "Refill once a year", v: "Unused" },
  { k: "No-claim bonus", v: "+10% next year" },
];

export const calcs = [
  { icon: "%", when: "Tax", t: "80D deduction", k: "You can claim", v: "Rs 75,000" },
  { icon: "▣", when: "Admission", t: "Room rent check", k: "Your limit", v: "Rs 5,000/day" },
  { icon: "◔", when: "Parents", t: "Co-pay on a bill", k: "On Rs 2L you pay", v: "Rs 40,000" },
  { icon: "↗", when: "Job switch", t: "When cover ends", k: "Last day", v: "Notice end" },
];

export const feedTabs = [["all", "For you"], ["news", "News"], ["video", "Videos"], ["guide", "Guides"]] as const;
export const feed = [
  { kind: "Video", tag: "video", len: "6:12", t: "Co-pay explained with a real hospital bill", why: "Because your parents’ plan has 20% co-pay", glyph: "▶" },
  { kind: "Guide", tag: "guide", len: "4 min", t: "Before Father’s next admission: the room rent question to ask", why: "Because his documents disagree on room rent", glyph: "▤" },
  { kind: "News", tag: "news", len: "3 min", t: "Insurers must settle cashless requests within 3 hours of discharge", why: "Applies to all three of your insurers", glyph: "◉" },
] as const;

export const moneyDesk = { headline: "6 premium receipts found. 1 looks paid twice.", matched: 4, missing: 1, duplicate: 1 };
export const handling = { headline: "Father’s short-settled claim is with the TPA.", steps: "Raised · With TPA · Documents · Resolved · next update Tue", done: 2 };
export const stressTeaser = { headline: "A knee replacement for Father would cost you Rs 2,20,000.", note: "His Rs 3L plan has a 20% co-pay and a sub-limit on joints." };
export const advisor = { line: "Free 15-minute call with a registered advisor about a top-up for your parents", mark: "AD" };
