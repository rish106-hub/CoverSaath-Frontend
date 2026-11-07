// Home overview data (board Home). All people, insurers and numbers are invented.

export type Stat = { prefix?: string; value: number; decimals?: number; suffix?: string; group?: boolean };

export const healthScore = 72;
export const healthGaps = [
  { t: "Rohan is not on the top-up", p: 8, href: "/compare" },
  { t: "Parents’ cover is Rs 3L each", p: 6, href: "/tools" },
  { t: "Room rent needs review", p: 4, href: "/policies" },
];

type GlanceTile = {
  icon: string; label: string; stat?: Stat; text?: string; detail: string; progress: number; href: string; tone: "plain" | "light" | "marker";
};
export const glanceTiles: GlanceTile[] = [
  { icon: "◎", label: "Total cover", stat: { prefix: "Rs ", value: 23, suffix: "L" }, detail: "Across 3 policies, 5 people", progress: 100, href: "/policies", tone: "light" },
  { icon: "◔", label: "Cover left", stat: { prefix: "Rs ", value: 21.5, decimals: 1, suffix: "L" }, detail: "Rs 1.48L used by Father", progress: 93, href: "/stress-test", tone: "plain" },
  { icon: "₹", label: "Monthly premium", stat: { prefix: "Rs ", value: 5308, group: true }, detail: "Rs 63,700 a year", progress: 0, href: "/money", tone: "plain" },
  { icon: "⇆", label: "Claims", text: "1 open", detail: "2 settled, Rs 58,240 recovered", progress: 66, href: "/desk", tone: "plain" },
  { icon: "↻", label: "Next renewal", text: "13 Mar", detail: "Parents’ plan, in 132 days", progress: 64, href: "/compare", tone: "plain" },
  { icon: "%", label: "Tax saving", stat: { prefix: "Rs ", value: 75000, group: true }, detail: "Section 80D, proofs due Jan", progress: 0, href: "/tools", tone: "marker" },
];

export const alerts = [
  { t: "Father’s room rent needs review", d: "Details differ between documents.", cta: "See both pages", href: "/policies", c: "var(--signal)" },
  { t: "Rohan is not on your top-up", d: "A bill over Rs 5L for him is not covered.", cta: "Compare top-ups", href: "/compare", c: "var(--ochre)" },
  { t: "Group cover ends with your job", d: "Plan a personal base policy first.", cta: "Check dates", href: "/tools", c: "var(--sea-glass)" },
];

export const monthStrip = ["NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT"];
export const yearTiles = [
  { m: "JAN", d: "15", in: "75 days", t: "Tax proofs to HR", s: "Rs 75,000 under 80D", cta: "Download papers", href: "/tools", band: "var(--marker)" },
  { m: "MAR", d: "13", in: "132 days", t: "Parents’ plan renews", s: "Meridian Care", cta: "Compare", href: "/compare", band: "var(--coral)" },
  { m: "MAR", d: "31", in: "150 days", t: "Group cover year ends", s: "Northstar Health", cta: "See what changes", href: "/tools", band: "var(--mist)" },
  { m: "JUN", d: "14", in: "225 days", t: "Top-up renews", s: "Kaveri General", cta: "Check debit", href: "/money", band: "var(--mist)" },
];

export const policyCards = [
  { icon: "◫", type: "Group cover", ins: "Northstar Health, through your employer", mark: "NH", cover: "Rs 5L", pm: "Rs 0", used: "Rs 0", up: 0, who: ["Meera", "Rohan", "Kabir"], ren: "31 Mar", c: "var(--harbour)", ink: "var(--on-harbour)" },
  { icon: "↗", type: "Super top-up", ins: "Kaveri General, after Rs 5L", mark: "KG", cover: "Rs 10L", pm: "Rs 658", used: "Rs 0", up: 0, who: ["Meera"], ren: "14 Jun", c: "var(--sea-glass)", ink: "#16130f" },
  { icon: "♥", type: "Parents’ plan", ins: "Meridian Care, senior plan", mark: "MC", cover: "Rs 3L each", pm: "Rs 4,650", used: "Rs 1.48L", up: 49, who: ["Mother", "Father"], ren: "13 Mar", c: "var(--ochre)", ink: "#16130f" },
];

type PersonBar = { name: string; rel: string; group: number; topup: number; senior: number; amount: string; share: string; groupPct: number; topupPct: number; seniorPct: number };
export const personBars: PersonBar[] = [
  { name: "Meera", rel: "You", group: 33, topup: 67, senior: 0, amount: "Rs 15L", share: "100%", groupPct: 50, topupPct: 50, seniorPct: 0 },
  { name: "Rohan", rel: "Spouse", group: 33, topup: 0, senior: 0, amount: "Rs 5L", share: "50%", groupPct: 50, topupPct: 0, seniorPct: 0 },
  { name: "Kabir", rel: "Son", group: 33, topup: 0, senior: 0, amount: "Rs 5L", share: "50%", groupPct: 50, topupPct: 0, seniorPct: 0 },
  { name: "Mother", rel: "Parent", group: 0, topup: 0, senior: 20, amount: "Rs 3L", share: "24%", groupPct: 0, topupPct: 0, seniorPct: 24 },
  { name: "Father", rel: "Parent", group: 0, topup: 0, senior: 20, amount: "Rs 3L", share: "24%", groupPct: 0, topupPct: 0, seniorPct: 24 },
];

export const claims = [
  { icon: "⇆", t: "Father, Kothrud Care, Aug", d: "Bill Rs 1.9L, insurer paid Rs 1.48L", s: "Open", tone: "marker" },
  { icon: "✓", t: "Mother, cataract approval", d: "Rs 55,000 approved, cashless", s: "Approved", tone: "harbour" },
  { icon: "✓", t: "Mother, pharmacy bill", d: "Rs 3,240 paid to your bank", s: "Paid", tone: "mist" },
] as const;
export const claimsLeft = [
  { k: "Father’s cover left", v: "Rs 1.52L" },
  { k: "Cover refill", v: "Not used" },
  { k: "No-claim bonus", v: "10% next year" },
];

export const calcs = [
  { icon: "%", when: "Tax", t: "80D deduction", k: "You can claim", v: "Rs 75,000" },
  { icon: "▣", when: "Admission", t: "Room rent check", k: "Your limit", v: "Rs 5,000/day" },
  { icon: "◔", when: "Parents", t: "Co-pay on a bill", k: "On Rs 2L you pay", v: "Rs 40,000" },
  { icon: "↗", when: "Job switch", t: "When cover ends", k: "Last day", v: "End of notice" },
];

export const feedTabs = [["all", "For you"], ["news", "News"], ["video", "Videos"], ["guide", "Guides"]] as const;
export const feed = [
  { kind: "Video", tag: "video", len: "6:12", t: "Co-pay explained with a hospital bill", why: "Your parents’ plan has 20% co-pay", glyph: "▶" },
  { kind: "Guide", tag: "guide", len: "4 min", t: "The room rent question to ask before admission", why: "Father’s room rent needs review", glyph: "▤" },
  { kind: "News", tag: "news", len: "3 min", t: "Insurers must settle cashless requests within 3 hours", why: "Applies to all your insurers", glyph: "◉" },
] as const;

export const moneyDesk = { headline: "6 premium receipts found. 1 may be paid twice.", matched: 4, missing: 1, duplicate: 1 };
export const handling = { headline: "Father’s claim is with the TPA.", steps: "Raised, with TPA, documents, resolved. Next update Tuesday.", done: 2 };
export const stressTeaser = { headline: "A knee replacement for Father would cost you Rs 2,20,000.", note: "His plan has a 20% co-pay and a cap on joints." };
export const advisor = { line: "Free 15-minute call with an advisor about a parents’ top-up", mark: "AD" };
