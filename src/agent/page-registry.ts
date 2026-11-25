import { pageFor } from "@/lib/ia";

/** What Ask Knowvia knows about the page the person is on. Copied from each board's `__voice()` data. */
export type VoiceExample = { say: string; steps: [string, string, string]; goHref?: string; goLabel?: string };
export type PageContext = { route: string; page: string; reads: string; examples: [VoiceExample, VoiceExample, VoiceExample] };

const ex = (say: string, steps: [string, string, string], goHref?: string, goLabel?: string): VoiceExample => ({ say, steps, goHref, goLabel });

/** Registry keyed by route pattern (see src/lib/ia.ts). Append-only: add new routes at the end. */
export const PAGE_CONTEXT: Record<string, PageContext> = {
  "/home": { route: "/home", page: "Home", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/assistant": { route: "/assistant", page: "Ask Knowvia", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/compare": { route: "/compare", page: "Compare plans", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/review": { route: "/review", page: "Things to check", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/desk": { route: "/desk", page: "Claims and insurer talks", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/family": { route: "/family", page: "My family", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/emergency": { route: "/emergency", page: "Emergency", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/money": { route: "/money", page: "Money desk", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/stress-test": { route: "/stress-test", page: "Stress test", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/tools": { route: "/tools", page: "Calculators and top-ups", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/cards": { route: "/cards", page: "Cards and wallet", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/policies/[id]": { route: "/policies/[id]", page: "Policy reader", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/welcome": { route: "/welcome", page: "Getting started", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  // Routes without a board `__voice()` block: examples written to match the page headings in src/lib/ia.ts.
  "/policies": { route: "/policies", page: "My policies", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/shortcuts": { route: "/shortcuts", page: "Shortcuts", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/settings": { route: "/settings", page: "Settings", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/profile": { route: "/profile", page: "Your profile", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  // Cover screens (S-B2).
  "/covers/add": { route: "/covers/add", page: "Add a cover", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/covers/declarations": { route: "/covers/declarations", page: "Declarations and money", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/covers/review": { route: "/covers/review", page: "What we found", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  // Chat and hospitals (S-C1).
  "/chat": { route: "/chat", page: "Ask about your cover", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/hospitals": { route: "/hospitals", page: "Network hospitals", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  // Public screens.
  "/": { route: "/", page: "Beta access", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
  ] },
  "/signin": { route: "/signin", page: "Sign in", reads: "your policies and this page", examples: [
    ex("What are my waiting periods?", ["Your policy", "Reads the waiting period section", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("What does my policy not cover?", ["Your policy", "Reads the exclusions", "Answers with the page it came from"], "/chat", "Ask this"),
    ex("Find a cashless hospital near me", ["Network hospitals", "Search by pincode", "Shows hospitals in your network"], "/hospitals", "Find hospitals"),
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
