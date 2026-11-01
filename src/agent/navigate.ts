import { PAGES } from "@/lib/ia";

/** Voice navigation: "open family", "go to my money", "show compare". Deterministic, no network. */
export type NavTarget = { route: string; href: string; label: string };

/** Extra spoken names per page. The tab label and route slug are always included. Append-only. */
const EXTRA: Record<string, { label?: string; say: string[] }> = {
  "/home": { say: ["home", "overview", "dashboard", "main page", "my cover", "cover"] },
  "/policies": { say: ["policies", "my policies", "policy", "my policy", "insurance"] },
  "/stress-test": { say: ["stress test", "stress", "test my cover", "what if"] },
  "/compare": { say: ["compare", "compare plans", "plans", "comparison"] },
  "/review": { say: ["review", "things to check", "to check", "decisions"] },
  "/family": { label: "My family", say: ["family", "my family", "people", "people and invites", "members", "invites"] },
  "/cards": { say: ["cards", "wallet", "cards and wallet", "e cards", "ecards", "e-cards"] },
  "/money": { label: "Money desk", say: ["money", "my money", "money desk", "receipts", "renewals"] },
  "/tools": { say: ["tools", "calculators", "top ups", "topups", "top-ups", "calculators and top ups", "advisors"] },
  "/desk": { say: ["desk", "claims", "cases", "open cases", "claims desk", "help", "claims and insurer talks"] },
  "/emergency": { say: ["emergency", "emergency page"] },
  "/assistant": { say: ["assistant", "ask knowvia", "ask"] },
  "/shortcuts": { say: ["shortcuts", "keyboard shortcuts"] },
  "/settings": { say: ["settings", "preferences"] },
  "/profile": { say: ["profile", "my profile", "account"] },
};

const squash = (t: string) => t.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9 -]+/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();

function build(): Map<string, NavTarget> {
  const map = new Map<string, NavTarget>();
  for (const p of PAGES) {
    if (p.route.includes("[")) continue;
    const extra = EXTRA[p.route];
    const target: NavTarget = { route: p.route, href: p.href, label: extra?.label ?? p.tab };
    const names = [p.tab, p.route.slice(1), ...(extra?.say ?? [])];
    for (const n of names) { const k = squash(n); if (k && !map.has(k)) map.set(k, target); }
  }
  return map;
}
const ALIASES = build();

const VERB = /^(?:please |can you |could you )?(?:open|go to|goto|go|take me to|take me|show me|show|navigate to|switch to|visit|bring up|chalo|dikhao)\s+(.+)$/;
const FILLER = /^(?:(?:to|my|the|me|our|a)\s+)+/;
const TAIL = /\s+(?:page|tab|screen|please)$/;

/** The page a navigation command names, or undefined when the text is not a plain "open X" command. */
export function resolveNavigation(text: string): NavTarget | undefined {
  const t = squash(text);
  const m = VERB.exec(t);
  const rest = m?.[1] ?? t.replace(/\s+(?:chalo|dikhao)$/, "");
  if (!m && rest === t) return undefined;
  const name = rest.replace(FILLER, "").replace(TAIL, "").trim();
  return ALIASES.get(name) ?? ALIASES.get(rest);
}

/** Every phrase that maps to a page, for tests and suggestions. */
export function navAliases(): ReadonlyMap<string, NavTarget> { return ALIASES; }
