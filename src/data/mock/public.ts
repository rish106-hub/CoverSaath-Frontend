// Copy and numbers for the public screens (Landing, Auth, Onboarding, Wallet). Synthetic data only.

export type TourScene = {
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

export const ONBOARD_WAYS = [
  { id: "dl", logo: "DL", t: "DigiLocker", d: "Pull every policy issued to your mobile number.", time: "Fastest · 20 s" },
  { id: "up", logo: "⇪", t: "Upload a PDF", d: "Policy wording, schedule or e-card.", time: "30 s" },
  { id: "hr", logo: "✉", t: "Forward the HR mail", d: "Send it to policies@knowvia.in and we read it.", time: "Hands-free" },
  { id: "no", logo: "#", t: "Policy number", d: "Pick your insurer and enter the number.", time: "1 min" },
] as const;
export const ONBOARD_TIPS = [
  { i: "✉", t: "Search your email", d: "Type “policy schedule” or your insurer’s name. The PDF is usually attached to the welcome mail.", k: "Most people find it here", tone: "mist" },
  { i: "◫", t: "Company cover? Ask HR", d: "HR or the benefits portal has the e-card and the group policy. One message is enough.", k: "Knowvia can write the message", tone: "ochre" },
  { i: "▣", t: "Look in DigiLocker", d: "Many insurers push policies to DigiLocker under “Issued documents”.", k: "Sign in once, we fetch it", tone: "violet" },
  { i: "⚿", t: "PDF asks for a password?", d: "It is often your date of birth (DDMMYYYY) or the first four letters of your name plus birth year.", k: "Say it; we never store it", tone: "coral" },
] as const;
export const READING_FINDINGS = [
  { icon: "◎", k: "Family cover", v: "Rs 5,00,000", ref: "Schedule p.1" },
  { icon: "▣", k: "Room limit", v: "Rs 5,000 a day", ref: "p.12 §4.1" },
  { icon: "%", k: "Co-pay", v: "None", ref: "p.2" },
  { icon: "◷", k: "Waiting period", v: "Waived (group plan)", ref: "p.8 §3" },
  { icon: "◉", k: "Members", v: "Meera, Rohan, Kabir", ref: "Schedule p.1" },
  { icon: "↻", k: "Restore benefit", v: "Once a year", ref: "p.18" },
] as const;
export const READING_SAY = [
  ["My father’s card shows another number", "Noted under Father · e-card. I’ll check it against his schedule when you add it."],
  ["I think HR changed the plan in April", "Filed as a question for HR. I’ll compare this policy with the April version if you forward it."],
  ["I paid my parents’ premium twice", "Opened a case on the Desk: duplicate premium. I’ll look for both receipts in Gmail."],
] as const;
export const READING_TIPS = [
  "Rs 5,000 a day is about a private single room in most Pune hospitals.",
  "Group plans usually waive waiting periods, so old conditions are covered from day one.",
  "Restore refills your cover once if a claim uses it up in the year.",
];
export const ONBOARD_PEOPLE = [
  { id: "M", n: "Meera", rel: "You · 41", on: true },
  { id: "R", n: "Rohan", rel: "Spouse · 43", on: true },
  { id: "K", n: "Kabir", rel: "Son · 8", on: true },
  { id: "A", n: "Parents", rel: "Not on this schedule", on: false },
];
export const ONBOARD_WINS = [
  { k: "Family cover", v: "Rs 5 lakh", d: "Shared by you, Rohan and Kabir. Refills once a year if used up.", ref: "Schedule p.1 · Wording p.18", tone: "mist" },
  { k: "Room limit", v: "Rs 5,000/day", d: "Pick a room within it and other charges are paid in full.", ref: "Wording p.12 §4.1", tone: "ochre" },
  { k: "Childbirth", v: "Rs 50,000", d: "Covered from day one on this group plan, plus the newborn from birth.", ref: "Wording p.21 §6.3", tone: "coral" },
] as const;

export type WalletCardData = { full: string; no: string; mid: string; valid: string; left: string; tpa: string; line: string; insurerShort: string; blood: string; room: string; copay: string };
export const WALLET_PEOPLE: Record<string, WalletCardData> = {
  Meera: { full: "Meera Rao", no: "NHG/2026/771204", mid: "NH-771204-01", valid: "31 Mar 2027", left: "Rs 5,00,000", tpa: "Northstar TPA", line: "1800 000 0000", insurerShort: "NORTHSTAR HEALTH", blood: "O+", room: "Rs 5,000 a day", copay: "None" },
  Rohan: { full: "Rohan Rao", no: "NHG/2026/771204", mid: "NH-771204-02", valid: "31 Mar 2027", left: "Rs 5,00,000", tpa: "Northstar TPA", line: "1800 000 0000", insurerShort: "NORTHSTAR HEALTH", blood: "B+", room: "Rs 5,000 a day", copay: "None" },
  Kabir: { full: "Kabir Rao", no: "NHG/2026/771204", mid: "NH-771204-03", valid: "31 Mar 2027", left: "Rs 5,00,000", tpa: "Northstar TPA", line: "1800 000 0000", insurerShort: "NORTHSTAR HEALTH", blood: "O+", room: "Rs 5,000 a day", copay: "None" },
  Mother: { full: "Lalitha Rao", no: "SNR/2026/048212", mid: "MC-048212", valid: "13 Mar 2027", left: "Rs 3,00,000", tpa: "Meridian desk", line: "1800 111 1111", insurerShort: "MERIDIAN CARE", blood: "A+", room: "Rs 3,000 a day", copay: "20% of each claim" },
  Father: { full: "Suresh Rao", no: "SNR/2026/048213", mid: "MC-048213", valid: "13 Mar 2027", left: "Rs 2,62,000", tpa: "Meridian desk", line: "1800 111 1111", insurerShort: "MERIDIAN CARE", blood: "B+", room: "Rs 3,000 a day", copay: "20% of each claim" },
};
export const WALLET_PASSES = [
  { id: "apple", name: "Apple Wallet", note: "iPhone and Mac. Opens from the lock screen." },
  { id: "google", name: "Google Wallet", note: "Android. One tap to add." },
  { id: "samsung", name: "Samsung Wallet", note: "Galaxy phones. One tap to add." },
] as const;
export const SHARE_APPLE = ["AirDrop", "WhatsApp", "Telegram", "Email", "Messages", "Google Chat", "Slack", "Download"];
export const SHARE_OTHER = ["WhatsApp", "Telegram", "Email", "Google Chat", "Signal", "Teams", "Scan with phone", "Download"];
export const SHARE_CHANNELS = ["WhatsApp", "SMS", "Email", "Telegram", "Google Chat", "Copy link"];
