/** Information architecture (BUILD-SPEC section 4). Single source for nav, headers and placeholders. */

export type GroupId = "cover" | "family" | "money" | "help";

export type Group = { id: GroupId; label: string; color: string; home: string };

export const GROUPS: readonly Group[] = [
  { id: "cover", label: "My cover", color: "var(--g-cover)", home: "/home" },
  { id: "family", label: "My family", color: "var(--g-family)", home: "/family" },
  { id: "money", label: "My money", color: "var(--g-money)", home: "/money" },
  { id: "help", label: "Help", color: "var(--g-help)", home: "/desk" },
] as const;

export type PageDef = {
  /** Route pattern (dynamic segments in brackets). */
  route: string;
  /** Link target (concrete). */
  href: string;
  /** Tab label. */
  tab: string;
  group: GroupId | null;
  title: string;
  kicker?: string;
  /** Section headings from the board; content comes from W1-W5. */
  sections: { heading: string; description?: string }[];
};

export const PAGES: readonly PageDef[] = [
  {
    route: "/home", href: "/home", tab: "Overview", group: "cover",
    title: "Good evening, Meera.", kicker: "Sunday, 1 November",
    sections: [
      { heading: "Your cover at a glance" },
      { heading: "Needs your attention" },
      { heading: "Your year" },
      { heading: "Your policies by type" },
      { heading: "Cover per person" },
      { heading: "Claims" },
      { heading: "Money desk" },
      { heading: "We're handling" },
      { heading: "Stress test" },
      { heading: "Advisor partner" },
      { heading: "Picked for your policies" },
    ],
  },
  {
    route: "/policies", href: "/policies", tab: "My policies", group: "cover",
    title: "My policies", kicker: "Answers for your family",
    sections: [{ heading: "Your policies" }],
  },
  {
    route: "/covers/add", href: "/covers/add", tab: "Add a cover", group: "cover",
    title: "Add a cover", kicker: "Your family’s cover",
    sections: [{ heading: "Policy schedule" }, { heading: "Policy terms and conditions" }, { heading: "Which plan is this?" }],
  },
  {
    route: "/covers/declarations", href: "/covers/declarations", tab: "Declarations and money", group: "cover",
    title: "Declarations and money", kicker: "Your family’s cover",
    sections: [{ heading: "What you told the insurer" }, { heading: "Premium you paid" }],
  },
  {
    route: "/covers/review", href: "/covers/review", tab: "What we found", group: "cover",
    title: "What we found in your policy", kicker: "Your family’s cover",
    sections: [{ heading: "Needs your decision" }, { heading: "Limits" }, { heading: "Waiting" }, { heading: "Exclusions" }, { heading: "Cashless" }, { heading: "Money" }],
  },
  {
    route: "/chat", href: "/chat", tab: "Ask about your cover", group: "cover",
    title: "Ask about your cover", kicker: "Your family’s cover",
    sections: [{ heading: "Conversation" }],
  },
  {
    route: "/hospitals", href: "/hospitals", tab: "Network hospitals", group: "cover",
    title: "Network hospitals", kicker: "Your family’s cover",
    sections: [{ heading: "Search by pincode" }],
  },
  {
    route: "/policies/[id]", href: "/policies/northstar-floater", tab: "My policies", group: "cover",
    title: "Your policy, read clause by clause", kicker: "Answers for you",
    sections: [{ heading: "Answers from your policy" }, { heading: "Where the documents disagree" }],
  },
  {
    route: "/stress-test", href: "/stress-test", tab: "Stress test", group: "cover",
    title: "If Mother needed this, who pays?", kicker: "Stress test",
    sections: [
      { heading: "The bill, step by step" },
      { heading: "Same treatment, whole family" },
      { heading: "Section by section" },
    ],
  },
  {
    route: "/compare", href: "/compare", tab: "Compare plans", group: "cover",
    title: "Which plan fits your family, not the brochure.", kicker: "Compare plans",
    sections: [
      { heading: "What matters to you" },
      { heading: "Fit for Meera's family" },
      { heading: "Section by section" },
      { heading: "Same bill, four plans" },
    ],
  },
  {
    route: "/review", href: "/review", tab: "Things to check", group: "cover",
    title: "3 things need you. Knowvia handled the rest.", kicker: "Your review · 1 Nov 2026",
    sections: [{ heading: "Recommended · check and edit" }, { heading: "New this round · have a look" }],
  },
  {
    route: "/family", href: "/family", tab: "People and invites", group: "family",
    title: "Meera's household", kicker: "My family",
    sections: [
      { heading: "People" },
      { heading: "Family on Knowvia" },
      { heading: "Policy by person" },
      { heading: "Gaps" },
      { heading: "Dates the documents give" },
      { heading: "Who sees what" },
    ],
  },
  {
    route: "/cards", href: "/cards", tab: "Cards and wallet", group: "family",
    title: "E-card, in your wallet", kicker: "Show this at any hospital desk.",
    sections: [{ heading: "Add to your wallet" }, { heading: "On the back of the pass" }],
  },
  {
    route: "/money", href: "/money", tab: "Money desk", group: "money",
    title: "Every premium and bill, matched.", kicker: "Money desk",
    sections: [
      { heading: "Found in your inbox" },
      { heading: "Coming up" },
      { heading: "Your year, month by month" },
      { heading: "Money on its way back" },
      { heading: "What Knowvia did this week" },
      { heading: "Premium and cover, years ahead" },
    ],
  },
  {
    route: "/tools", href: "/tools", tab: "Calculators and top-ups", group: "money",
    title: "Free tools. No sign-up.", kicker: "Calculators and top-ups",
    sections: [
      { heading: "Section 80D" },
      { heading: "Room rent" },
      { heading: "Exit-papers checklist" },
      { heading: "Top-up finder" },
      { heading: "Registered advisors" },
      { heading: "What these tools saved families like yours" },
    ],
  },
  {
    route: "/desk", href: "/desk", tab: "Claims and insurer talks", group: "help",
    title: "We talk to the TPA and insurer. You get updates.", kicker: "Claims and insurer talks",
    sections: [
      { heading: "Your cases" },
      { heading: "If they say no, here is where we go next" },
      { heading: "Knowvia right now" },
    ],
  },
  {
    route: "/emergency", href: "/emergency", tab: "Emergency", group: "help",
    title: "Emergency", kicker: "Stay calm. Knowvia has the papers ready.",
    sections: [
      { heading: "Cashless e-card" },
      { heading: "Best hospital now" },
      { heading: "Blood near you" },
    ],
  },
  {
    route: "/assistant", href: "/assistant", tab: "Ask Knowvia", group: "help",
    title: "Ask Knowvia", kicker: "Plain-language helper",
    sections: [{ heading: "How Knowvia understands you" }, { heading: "Try saying" }],
  },
  {
    route: "/shortcuts", href: "/shortcuts", tab: "Shortcuts", group: null,
    title: "One input, start to finish", kicker: "Pick how you move. Never switch.",
    sections: [{ heading: "Keyboard" }, { heading: "Mouse" }, { heading: "Voice" }],
  },
  {
    route: "/settings", href: "/settings", tab: "Settings", group: null,
    title: "Settings", kicker: "Your account",
    sections: [{ heading: "Connected sources" }, { heading: "Account" }],
  },
  {
    route: "/profile", href: "/profile", tab: "Profile", group: null,
    title: "Your profile", kicker: "Your details",
    sections: [
      { heading: "You" },
      { heading: "Registered address (optional)" },
      { heading: "Location" },
      { heading: "Connected sources" },
      { heading: "Your account" },
    ],
  },
] as const;

export const PUBLIC_ROUTES = ["/", "/signin", "/welcome", "/status"] as const;
export const ONBOARDING_ROUTES = ["/welcome", "/welcome/add", "/welcome/reading", "/welcome/people", "/welcome/ready"] as const;

export const groupById = (id: GroupId): Group => GROUPS.find((g) => g.id === id) as Group;

export function pagesIn(group: GroupId): PageDef[] {
  return PAGES.filter((p) => p.group === group && !p.route.includes("["));
}

/** Resolve a pathname to its page definition (dynamic routes included). */
export function pageFor(pathname: string): PageDef | undefined {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const exact = PAGES.find((p) => p.route === clean);
  if (exact) return exact;
  if (clean.startsWith("/policies/")) return PAGES.find((p) => p.route === "/policies/[id]");
  return undefined;
}

/** The tab that should be marked current for a pathname. */
export function activeTab(pathname: string): string | undefined {
  return pageFor(pathname)?.tab;
}

/** Accent context for colour-coded buttons: the page's group, or "none" (neutral ink) for profile, settings, shortcuts and public pages. */
export function groupOf(pathname: string): GroupId | "none" {
  return pageFor(pathname)?.group ?? "none";
}
