// Copy and numbers for the public screens (Landing, Auth, Onboarding, Wallet). Redacted placeholders only; nothing here is a real figure or person.

type TourScene = {
  t: string; path: string; title: string; tag: string;
  tiles: [string, string, "ink" | "plain" | "marker" | "signal"][];
  bars: [string, number, "ink" | "soft" | "signal" | "ochre" | "dark", string][];
  say: string; reply: string; nav: number;
};

export const TOUR_NAV = ["Home", "Stress test", "Compare", "Money", "Family", "Emergency", "Talk"];

export const TOUR_SCENES: TourScene[] = [
  { t: "Home", path: "home", title: "Good evening.", tag: "Health •• / ••", tiles: [["Total cover", "Rs ••,•••", "ink"], ["Premium a month", "Rs ••,•••", "plain"], ["Next renewal", "••", "marker"]], bars: [["Member 1", 100, "ink", "Rs ••,•••"], ["Member 2", 33, "ink", "Rs ••,•••"], ["Member 3", 20, "ochre", "Rs ••,•••"], ["Member 4", 20, "ochre", "Rs ••,•••"]], say: "What needs my attention?", reply: "Your answer appears here, with the page it came from.", nav: 0 },
  { t: "Stress test", path: "stress-test", title: "If a big bill came, who pays?", tag: "Gap ••", tiles: [["Bill", "Rs ••,•••", "plain"], ["Insurer pays", "Rs ••,•••", "ink"], ["You pay", "Rs ••,•••", "signal"]], bars: [["Bill", 100, "dark", "••"], ["Cap", 52, "signal", "••"], ["Co-pay", 20, "signal", "••"], ["Insurer", 42, "ink", "••"]], say: "What needs my attention?", reply: "Your answer appears here, with the page it came from.", nav: 1 },
  { t: "Compare", path: "compare", title: "Which plan fits your family?", tag: "Best fit ••", tiles: [["Today", "••", "plain"], ["Top-up", "••", "marker"], ["You’d pay on a big claim", "Rs ••,•••", "ink"]], bars: [["Today", 67, "soft", "••"], ["Plan 1", 94, "ink", "••"], ["Plan 2", 67, "soft", "••"], ["Plan 3", 100, "ink", "••"]], say: "What needs my attention?", reply: "Your answer appears here, with the page it came from.", nav: 2 },
  { t: "Money", path: "money", title: "Every premium and bill, matched.", tag: "•• paid twice", tiles: [["Receipts found", "••", "plain"], ["80D you can claim", "Rs ••,•••", "ink"], ["On its way back", "Rs ••,•••", "marker"]], bars: [["Month 1", 100, "ink", "••"], ["Month 2", 76, "soft", "••"], ["Month 3", 25, "soft", "••"], ["Month 4", 10, "soft", "••"]], say: "What needs my attention?", reply: "Your answer appears here, with the page it came from.", nav: 3 },
  { t: "Emergency", path: "emergency", title: "Someone needs care. Start here.", tag: "Cashless nearby", tiles: [["Nearest cashless", "•• min", "signal"], ["Heart unit", "••", "plain"], ["E-card", "••", "ink"]], bars: [["Hospital 1", 92, "ink", "•• min"], ["Hospital 2", 78, "ink", "•• min"], ["Hospital 3", 60, "soft", "•• min"], ["Hospital 4", 40, "soft", "•• min"]], say: "What needs my attention?", reply: "Your answer appears here, with the page it came from.", nav: 5 },
  { t: "Talk", path: "talk", title: "Say it, it opens.", tag: "Talk to Knowvia", tiles: [["Opens pages", "Any", "ink"], ["Answers", "From your policy", "plain"], ["Where", "Bottom of every page", "marker"]], bars: [["Open my family", 100, "ink", "Opens"], ["Is cataract covered?", 80, "soft", "Answers"], ["Open money desk", 60, "ink", "Opens"], ["Nearest cashless hospital", 40, "soft", "Answers"]], say: "What needs my attention?", reply: "Your answer appears here, with the page it came from.", nav: 6 },
];

/** The four clickable stats: value, label, month, tour scene index, accent token, story. Figures are redacted placeholders, never invented numbers. */
export const FAMILY_STATS = [
  { v: "Rs ••,•••", t: "tax saved", m: "••", scene: 3, accent: "var(--harbour)", story: "Premium receipts found and an 80D proof pack built." },
  { v: "Rs ••,•••", t: "gap found early", m: "••", scene: 1, accent: "var(--signal)", story: "The stress test shows what you would pay before anyone is in hospital." },
  { v: "••", t: "better-fitting plan", m: "••", scene: 2, accent: "var(--g-money)", story: "Plans compared on what your family cares about." },
  { v: "•• min", t: "to admission", m: "••", scene: 4, accent: "var(--g-family)", story: "Nearest cashless hospital found, e-card ready at the desk." },
] as const;

export const FAMILY_ALL_YEAR = { accent: "var(--harbour)", story: "One home for every policy and person, with the next renewal on the calendar." };

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
  { k: "YOUR COVER", v: "Rs ••,•••", d: "Shared by •• people", ref: "Schedule p.••", more: "Your policy’s cover amount appears here, read from your schedule.", tag: "cover", bar: 70, tone: "paper" },
  { k: "ROOM LIMIT", v: "Rs ••,•••", d: "A single private room", ref: "p.•• §••", more: "Pick a room within the limit and every other charge is paid in full.", tag: "cover", bar: 50, tone: "marker" },
  { k: "TAX YOU CAN SAVE", v: "Rs ••,•••", d: "80D, old regime", ref: "Premium receipts", more: "Your 80D limit appears here, worked out from your receipts.", tag: "money", bar: 100, tone: "coral" },
  { k: "CO-PAY", v: "••", d: "Of every claim", ref: "Senior plan p.••", more: "What you pay on each claim appears here, with the page it came from.", tag: "family", bar: 20, tone: "dark" },
  { k: "NEXT RENEWAL", v: "••", d: "Your policy", ref: "Schedule p.••", more: "We’ll compare plans before renewal so you can decide early.", tag: "family", bar: 35, tone: "mist" },
  { k: "BIG BILL", v: "Rs ••,•••", d: "You’d pay this today", ref: "Stress test", more: "What a big bill would leave on you appears here.", tag: "money", bar: 58, tone: "paper" },
  { k: "RECEIPTS FOUND", v: "••", d: "In your Gmail", ref: "Money desk", more: "A premium that looks paid twice opens a refund case for you.", tag: "money", bar: 80, tone: "ochre" },
  { k: "CASHLESS NEAR YOU", v: "•• min", d: "A hospital near you", ref: "Network list", more: "Whether your e-card works there appears here.", tag: "family", bar: 90, tone: "paper" },
  { k: "WAITING PERIOD", v: "••", d: "Your policy", ref: "p.•• §••", more: "Waiting periods are read from your policy and shown with the page.", tag: "cover", bar: 100, tone: "mist" },
];
export const AUTH_WHYS = [
  { i: "◎", t: "One minute to answers", d: "Drop a PDF or use DigiLocker" },
  { i: "⌘", t: "Keyboard, mouse or voice", d: "Finish with whichever you started" },
  { i: "◈", t: "AES-256 encrypted", d: "You choose who sees what" },
];

