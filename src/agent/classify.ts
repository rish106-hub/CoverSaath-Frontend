/** Deterministic classifier for Ask Knowvia (BUILD-SPEC 5.1). Rules plus keyword scoring, English and Hinglish. No model calls. */

export const INTENTS = [
  "emergency", "explain_term", "ask_policy", "calculate", "compare", "add_document",
  "payment", "claim_help", "family", "navigate", "remind", "note", "smalltalk",
] as const;
export type Intent = (typeof INTENTS)[number];

export type AgentAction = { label: string; href: string };

export type Classified = {
  intent: Intent;
  person?: string;
  topic?: string;
  confidence: number;
  route?: string;
  reply: string;
  steps: [string, string, string];
  actions: AgentAction[];
};

const EMERGENCY = [
  /chest\s*pain/, /heart\s*attack/, /\bdard\b.*\b(seene|chest|bahut)\b/, /(papa|mumma|mummy|dad|mom|baba|maa)\s+ko\s+(dard|chest|saans)/,
  /\baccident\b/, /\bicu\b/, /\bblood\b/, /\bkhoon\b/, /\bunconscious\b/, /\bbehosh\b/, /\bemergency\b/, /can'?t breathe|saans nahi/, /\bambulance\b/, /\bstroke\b/,
];

type Rule = { intent: Intent; words: RegExp[]; route?: string };

const RULES: Rule[] = [
  { intent: "explain_term", words: [/\bwhat is\b/, /\bwhat does .* mean\b/, /\bexplain\b/, /\bmeaning of\b/, /\bkya hota hai\b/, /\bmatlab\b/, /\bco-?pay\b/, /\bwaiting period\b/, /\bdeductible\b/, /\bsub-?limit\b/, /\broom rent\b/], route: "/assistant" },
  { intent: "ask_policy", words: [/\bcovered\b/, /\bcover\b/, /\bclause\b/, /\bpage \d+/, /\bpolicy\b/, /\bmaternity\b/, /\bcataract\b/, /\bkya cover\b/, /\bcover hai\b/, /\bsum insured\b/, /\bis .* on the\b/], route: "/policies" },
  { intent: "calculate", words: [/\bhow much\b/, /\bcalculate\b/, /\b80d\b/, /\binflation\b/, /\bkitna\b/, /\bwhat if\b/, /\bbypass\b/, /\bbill of\b/, /\bwill rs\b/, /\benough\b/, /\bpremium .* years\b/], route: "/stress-test" },
  { intent: "compare", words: [/\bcompare\b/, /\bwhich plan\b/, /\bbest plan\b/, /\bversus\b|\bvs\b/, /\bbetter plan\b/, /\bkaun sa plan\b/, /\bpriority\b/, /\bmake .* priority\b/], route: "/compare" },
  { intent: "add_document", words: [/\badd (a |my |the )?(policy|document|card|receipt|pdf)/, /\bupload\b/, /\bscan\b/, /\bnew policy\b/, /\bphoto of\b/, /\bdocument (add|dalo|jodo)\b/, /\bpolicy (add|upload)\b/, /\bgmail\b/, /\bdigilocker\b/], route: "/welcome/add" },
  { intent: "payment", words: [/\bpay\b/, /\bpaid\b/, /\bpremium\b/, /\brefund\b/, /\bpaise\b/, /\bbill\b/, /\brenew(al)?\b/, /\binvoice\b/, /\bpayment\b/, /\bbhugtan\b/], route: "/money" },
  { intent: "claim_help", words: [/\bclaim\b/, /\bclaims\b/, /\btpa\b/, /\badmit(ted)?\b/, /\bdischarge\b/, /\breject(ed)?\b/, /\bescalate\b/, /\bcashless\b/, /\bhospital\b/, /\bshort claim\b/, /\binsurer\b/], route: "/desk" },
  { intent: "family", words: [/\bfamily\b/, /\binvite\b/, /\badd my (sister|brother|wife|husband|son|daughter|mother|father)\b/, /\bwho is on\b/, /\bgaps?\b/, /\bparivar\b/, /\be-?card\b/, /\bmember\b/], route: "/family" },
  { intent: "remind", words: [/\bremind\b/, /\breminder\b/, /\bcalendar\b/, /\byaad\b/, /\bnotify me\b/, /\btell me when\b/], route: "/money" },
  { intent: "note", words: [/\bnote\b/, /\bnote down\b/, /\bwrite down\b/, /\bremember that\b/, /\bsave this\b/, /\blikh\b/], route: undefined },
  { intent: "navigate", words: [/\bgo to\b/, /\btake me\b/, /\bopen\b/, /\bshow (me )?(my )?(open )?(cases|home|policies|settings|shortcuts|cards|desk)\b/, /\bchalo\b/, /\bdikhao\b/, /\bhome\b/, /\bsettings\b/], route: undefined },
  { intent: "smalltalk", words: [/^(hi|hello|hey|namaste|namaskar)\b/, /\bthank(s| you)\b/, /\bshukriya\b/, /\bwho are you\b/, /\bwhat can you do\b/, /\bhow are you\b/, /\bgood (morning|evening|night)\b/], route: undefined },
];

const NAV_TARGETS: [RegExp, string, string][] = [
  [/\bhome\b|\boverview\b/, "/home", "Home"],
  [/\bdesk\b|\bcases\b|\bclaims?\b/, "/desk", "Claims and insurer talks"],
  [/\bpolicies\b|\bpolicy\b/, "/policies", "My policies"],
  [/\bsettings\b/, "/settings", "Settings"],
  [/\bshortcuts?\b/, "/shortcuts", "Shortcuts"],
  [/\bcards?\b|\bwallet\b/, "/cards", "Cards and wallet"],
  [/\bmoney\b/, "/money", "Money desk"],
  [/\bfamily\b/, "/family", "People and invites"],
  [/\btools?\b|\bcalculators?\b/, "/tools", "Calculators and top-ups"],
  [/\bcompare\b/, "/compare", "Compare plans"],
  [/\bstress\b/, "/stress-test", "Stress test"],
];

const PEOPLE: [RegExp, string][] = [
  [/\b(papa|father|dad|baba|pitaji)\b/, "Father"],
  [/\b(mumma|mummy|mother|mom|maa|mataji)\b/, "Mother"],
  [/\brohan\b/, "Rohan"],
  [/\bkabir\b/, "Kabir"],
  [/\bmeera\b/, "Meera"],
  [/\bpriya\b/, "Priya"],
];

const TOPICS: [RegExp, string][] = [
  [/co-?pay/, "co-pay"], [/room rent/, "room rent"], [/waiting period/, "waiting period"],
  [/cataract/, "cataract"], [/maternity/, "maternity"], [/80d/, "Section 80D"], [/top-?up/, "top-up"],
  [/refund/, "refund"], [/bypass/, "bypass"], [/renew/, "renewal"],
];

const normalise = (t: string) => t.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

export function detectPerson(text: string): string | undefined {
  const t = normalise(text);
  return PEOPLE.find(([re]) => re.test(t))?.[1];
}
export function detectTopic(text: string): string | undefined {
  const t = normalise(text);
  return TOPICS.find(([re]) => re.test(t))?.[1];
}

const EMPTY: Classified["steps"] = ["Understood you", "Looked at what you have shared", "Ready"];

export function classify(input: string): Classified {
  const t = normalise(input);
  const person = detectPerson(t);
  const topic = detectTopic(t);

  if (!t) {
    return { intent: "smalltalk", confidence: 0.2, reply: "Say or type what you need.", steps: EMPTY, actions: [] };
  }

  if (EMERGENCY.some((re) => re.test(t))) {
    return {
      intent: "emergency", person, topic, confidence: 0.98, route: "/emergency",
      reply: `Opening Emergency${person ? ` for ${person}` : ""}. The e-card and nearest cashless hospital are ready.`,
      steps: [`Emergency${person ? ` · ${person}` : ""}`, "Nearest cashless hospital found", "E-card ready to show"],
      actions: [{ label: "Go to Emergency", href: "/emergency" }],
    };
  }

  const scores = RULES.map((r, i) => ({ r, i, score: r.words.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0) }));
  // Specific verbs beat generic nouns: reminder and note phrasing outrank everything else.
  const best = scores
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)[0];
  const priority = scores.find((s) => s.score > 0 && (s.r.intent === "remind" || s.r.intent === "note" || s.r.intent === "add_document"));
  const hit = priority && best && priority.score >= best.score - 1 ? priority : best;

  if (!hit) {
    return { intent: "smalltalk", person, topic, confidence: 0.3, reply: "I can read your policies, track claims and find hospitals. Try one of the examples.", steps: EMPTY, actions: [] };
  }

  let route = hit.r.route;
  let navLabel: string | undefined;
  if (hit.r.intent === "navigate") {
    const target = NAV_TARGETS.find(([re]) => re.test(t));
    if (target) { route = target[1]; navLabel = target[2]; }
  }
  if (hit.r.intent === "claim_help" && /\bfamily\b/.test(t)) route = "/family";

  const confidence = Math.min(0.95, 0.55 + 0.15 * hit.score + (person ? 0.05 : 0) + (topic ? 0.05 : 0));
  const label = navLabel ?? (route ? (NAV_TARGETS.find(([, r]) => r === route)?.[2] ?? "this page") : undefined);
  const actions: AgentAction[] = route && hit.r.intent !== "smalltalk" ? [{ label: `Go to ${label ?? "this page"}`, href: route }] : [];

  return {
    intent: hit.r.intent, person, topic, confidence, route,
    reply: "", // filled by the responder from page context and household data
    steps: EMPTY,
    actions,
  };
}
