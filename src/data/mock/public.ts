// Copy and numbers for the public screens (Landing, Auth, Onboarding, Wallet). Synthetic data only.

type TourScene = {
  t: string; path: string; title: string; tag: string;
  tiles: [string, string, "ink" | "plain" | "marker" | "signal"][];
  bars: [string, number, "ink" | "soft" | "signal" | "ochre" | "dark", string][];
  say: string; reply: string; nav: number;
};

export const TOUR_NAV = ["Home", "Stress test", "Compare", "Money", "Family", "Emergency", "Talk"];

export const TOUR_SCENES: TourScene[] = [
  { t: "Home", path: "home", title: "Good evening, Meera.", tag: "Health 72 / 100", tiles: [["Total cover", "Rs 23L", "ink"], ["Premium a month", "Rs 5,308", "plain"], ["Next renewal", "13 Mar", "marker"]], bars: [["Meera", 100, "ink", "Rs 15L"], ["Rohan", 33, "ink", "Rs 5L"], ["Mother", 20, "ochre", "Rs 3L"], ["Father", 20, "ochre", "Rs 3L"]], say: "What needs my attention?", reply: "Three things. Father’s room rent differs between documents; that one first.", nav: 0 },
  { t: "Stress test", path: "stress-test", title: "If Father needed a knee, who pays?", tag: "Big gap", tiles: [["Bill", "Rs 3.8L", "plain"], ["Insurer pays", "Rs 1.6L", "ink"], ["You pay", "Rs 2.2L", "signal"]], bars: [["Bill", 100, "dark", "3.8L"], ["Cap", 52, "signal", "2L"], ["Co-pay", 20, "signal", "20%"], ["Insurer", 42, "ink", "1.6L"]], say: "What would a knee surgery cost Papa?", reply: "About Rs 2.2L from you. The cap and 20% co-pay do most of it.", nav: 1 },
  { t: "Compare", path: "compare", title: "Which plan fits your family?", tag: "Best fit 94%", tiles: [["Today", "67%", "plain"], ["Kaveri top-up", "94%", "marker"], ["You’d pay on a bypass", "Rs 13k", "ink"]], bars: [["Today", 67, "soft", "67%"], ["Kaveri", 94, "ink", "94%"], ["Meridian", 67, "soft", "67%"], ["Indus", 100, "ink", "100%"]], say: "Parents first. I hate surprise bills.", reply: "Then Indus Shield fits best: no co-pay, any room.", nav: 2 },
  { t: "Money", path: "money", title: "Every premium and bill, matched.", tag: "1 paid twice", tiles: [["Receipts found", "6", "plain"], ["80D you can claim", "Rs 75k", "ink"], ["On its way back", "Rs 60,890", "marker"]], bars: [["Mar", 100, "ink", "31,700"], ["Apr", 76, "soft", "24,100"], ["Jun", 25, "soft", "7,900"], ["Aug", 10, "soft", "3,240"]], say: "Find my premium receipts for tax.", reply: "Found 4 in Gmail. Your 80D pack is ready for HR.", nav: 3 },
  { t: "Emergency", path: "emergency", title: "Father needs care. Start here.", tag: "Cashless nearby", tiles: [["Nearest cashless", "7 min", "signal"], ["Heart unit", "Yes", "plain"], ["E-card", "Ready", "ink"]], bars: [["Kothrud", 92, "ink", "7 min"], ["Paud Road", 78, "ink", "11 min"], ["Deccan", 60, "soft", "16 min"], ["Wanowrie", 40, "soft", "24 min"]], say: "Papa ko chest pain ho raha hai.", reply: "Call 112. Kothrud Care is cashless on his plan. Route sent to Rohan.", nav: 5 },
  { t: "Talk", path: "talk", title: "Say it, it opens.", tag: "Talk to Knowvia", tiles: [["Opens pages", "Any", "ink"], ["Answers", "From your policy", "plain"], ["Where", "Bottom of every page", "marker"]], bars: [["Open my family", 100, "ink", "Opens"], ["Is cataract covered?", 80, "soft", "Answers"], ["Open money desk", 60, "ink", "Opens"], ["Nearest cashless hospital", 40, "soft", "Answers"]], say: "Open my family.", reply: "Opening My family. Tap Talk to Knowvia at the bottom of any page.", nav: 6 },
];

/** The four clickable stats: value, label, month, tour scene index, accent token, story. */
export const FAMILY_STATS = [
  { v: "Rs 75k", t: "tax saved", m: "January", scene: 3, accent: "var(--harbour)", story: "Found 4 premium receipts in Gmail and built her 80D proof pack for HR." },
  { v: "Rs 2.2L", t: "gap found early", m: "March", scene: 1, accent: "var(--signal)", story: "The stress test showed Father’s knee surgery would leave Rs 2.2L to pay, before anyone was in hospital." },
  { v: "94%", t: "better-fitting plan", m: "May", scene: 2, accent: "var(--g-money)", story: "Compared four plans on what the family cares about and found a top-up that fits 94%." },
  { v: "22 min", t: "to admission", m: "August", scene: 4, accent: "var(--g-family)", story: "Father’s chest pain: nearest cashless heart unit, e-card ready at the desk, admitted in 22 minutes." },
] as const;

export const FAMILY_ALL_YEAR = { accent: "var(--harbour)", story: "All year · One home for 3 policies and 5 people, with the next renewal already on the calendar." };

export const LANDING_POINTS = [
  { i: "◐", t: "Reads your policy in a minute", d: "Plain words, with page references." },
  { i: "₹", t: "Shows what you would pay", d: "For every person, before the bill." },
  { i: "✓", t: "Handles the follow-up", d: "Claims, renewals and refunds." },
] as const;

export const AUTH_HEADS: [string, string][] = [
  ["Your cover, in numbers.", "Not in 60 pages."],
  ["Every person, every policy.", "One screen."],
  ["What you’d pay,", "before the hospital asks."],
];
export const AUTH_FILTERS = [["all", "Everything"], ["cover", "My cover"], ["family", "My family"], ["money", "Money"]] as const;
export type AuthCard = { k: string; v: string; d: string; ref: string; more: string; tag: "cover" | "family" | "money"; bar: number; tone: "paper" | "marker" | "coral" | "dark" | "mist" | "ochre" };
export const AUTH_CARDS: AuthCard[] = [
  { k: "YOUR COVER", v: "Rs 5,00,000", d: "Shared by 3 people", ref: "Schedule p.1", more: "One floater for you, Rohan and Kabir. It refills once a year if a claim uses it up.", tag: "cover", bar: 70, tone: "paper" },
  { k: "ROOM LIMIT", v: "Rs 5,000/day", d: "A single private room", ref: "p.12 §4.1", more: "Pick a room within this and every other charge is paid in full.", tag: "cover", bar: 50, tone: "marker" },
  { k: "TAX YOU CAN SAVE", v: "Rs 75,000", d: "80D, old regime", ref: "Premium receipts", more: "Rs 25,000 for your family plus Rs 50,000 for parents over 60.", tag: "money", bar: 100, tone: "coral" },
  { k: "CO-PAY · PARENTS", v: "20%", d: "Of every claim", ref: "Senior plan p.2", more: "On a Rs 1,00,000 bill your parents pay Rs 20,000.", tag: "family", bar: 20, tone: "dark" },
  { k: "NEXT RENEWAL", v: "13 Mar", d: "Parents’ senior plan", ref: "Schedule p.1", more: "We’ll compare plans in February so you can decide early.", tag: "family", bar: 35, tone: "mist" },
  { k: "KNEE SURGERY · FATHER", v: "Rs 2.2L", d: "You’d pay this today", ref: "Stress test", more: "A sub-limit plus 20% co-pay. A super top-up cuts it to about Rs 76,000.", tag: "money", bar: 58, tone: "paper" },
  { k: "RECEIPTS FOUND", v: "6", d: "In your Gmail", ref: "Money desk", more: "One premium looks paid twice. We open a refund case for you.", tag: "money", bar: 80, tone: "ochre" },
  { k: "CASHLESS NEAR YOU", v: "7 min", d: "Kothrud Care Hospital", ref: "Network list", more: "Your e-card works there. ICU beds and a 24×7 insurance desk.", tag: "family", bar: 90, tone: "paper" },
  { k: "WAITING PERIOD", v: "Waived", d: "Group plan", ref: "p.8 §3", more: "Old conditions are covered from day one on your employer’s plan.", tag: "cover", bar: 100, tone: "mist" },
];
export const AUTH_WHYS = [
  { i: "◎", t: "One minute to answers", d: "Drop a PDF or use DigiLocker" },
  { i: "⌘", t: "Keyboard, mouse or voice", d: "Finish with whichever you started" },
  { i: "◈", t: "AES-256 encrypted", d: "You choose who sees what" },
];

