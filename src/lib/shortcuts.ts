"use client";

import { useEffect, useRef } from "react";

/** Keyboard map (BUILD-SPEC 5.2). Key hints are shown on /shortcuts and the ? overlay; the V hold-to-talk hint is also on the voice dock, coach and panel (owner request: voice must be discoverable). */
export type ShortcutSection = "Go to" | "Act" | "Move" | "On a page";
export type Shortcut = {
  id: string;
  /** Lower-case keys; two keys means a sequence (G then H) within SEQUENCE_MS. */
  keys: string[];
  label: string;
  section: ShortcutSection;
  /** Route prefix (or prefixes) where the shortcut applies; omitted means everywhere. */
  scope?: string | string[];
  /** Route to open, for "Go to" shortcuts. */
  href?: string;
};

export const SEQUENCE_MS = 1000;

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "go-home", keys: ["g", "h"], label: "Go to Home", section: "Go to", href: "/home" },
  { id: "go-policies", keys: ["g", "p"], label: "Go to My policies", section: "Go to", href: "/policies" },
  { id: "go-stress", keys: ["g", "s"], label: "Go to Stress test", section: "Go to", href: "/stress-test" },
  { id: "go-compare", keys: ["g", "c"], label: "Go to Compare plans", section: "Go to", href: "/compare" },
  { id: "go-money", keys: ["g", "m"], label: "Go to Money desk", section: "Go to", href: "/money" },
  { id: "go-desk", keys: ["g", "d"], label: "Go to Claims and insurer talks", section: "Go to", href: "/desk" },
  { id: "go-family", keys: ["g", "f"], label: "Go to People and invites", section: "Go to", href: "/family" },
  { id: "go-profile", keys: ["g", "u"], label: "Go to Your profile", section: "Go to", href: "/profile" },
  { id: "emergency", keys: ["e"], label: "Emergency", section: "Act", href: "/emergency" },
  { id: "voice", keys: ["v"], label: "Hold to talk to Knowvia", section: "Act" },
  { id: "type", keys: ["/"], label: "Type to Knowvia", section: "Act" },
  { id: "add-document", keys: ["n"], label: "Add a document", section: "Act", href: "/welcome/add" },
  { id: "theme", keys: ["t"], label: "Switch light and dark", section: "Act" },
  { id: "help", keys: ["?"], label: "Show shortcuts", section: "Act" },
  { id: "close", keys: ["escape"], label: "Close", section: "Act" },
  { id: "next", keys: ["j"], label: "Next item", section: "Move" },
  { id: "prev", keys: ["k"], label: "Previous item", section: "Move" },
  { id: "open", keys: ["enter"], label: "Open item", section: "Move" },
  ...["1", "2", "3", "4", "5"].map((n): Shortcut => ({ id: `person-${n}`, keys: [n], label: "Pick a person", section: "On a page", scope: ["/family", "/stress-test", "/emergency"] })),
  ...["1", "2", "3", "4"].map((n): Shortcut => ({ id: `plan-${n}`, keys: [n], label: "Pick a plan", section: "On a page", scope: "/compare" })),
  { id: "accept", keys: ["a"], label: "Accept a thing to check", section: "On a page", scope: "/review" },
  { id: "change", keys: ["c"], label: "Change a thing to check", section: "On a page", scope: "/review" },
];

export const isEditable = (el: EventTarget | null): boolean => {
  const e = el as HTMLElement | null;
  if (!e || !e.tagName) return false;
  const tag = e.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.isContentEditable === true;
};

const scopes = (s: Shortcut): string[] => (s.scope === undefined ? [] : Array.isArray(s.scope) ? s.scope : [s.scope]);
const inScope = (s: Shortcut, pathname: string) => !s.scope || scopes(s).some((sc) => pathname === sc || pathname.startsWith(`${sc}/`));

/** Sequence matcher: `g` arms, the next key within SEQUENCE_MS completes. Pure, so it is easy to test. */
export function createMatcher(opts: { now?: () => number; ms?: number } = {}) {
  const now = opts.now ?? Date.now;
  const ms = opts.ms ?? SEQUENCE_MS;
  let armed: { key: string; at: number } | null = null;
  return {
    /** Returns the matched shortcut id, "pending" while a sequence is armed, or null. */
    feed(rawKey: string, pathname: string): string | "pending" | null {
      const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey.toLowerCase();
      const live = armed && now() - armed.at <= ms ? armed : null;
      armed = null;
      if (live) {
        const hit = SHORTCUTS.find((s) => s.keys.length === 2 && s.keys[0] === live.key && s.keys[1] === key && inScope(s, pathname));
        if (hit) return hit.id;
      }
      if (SHORTCUTS.some((s) => s.keys.length === 2 && s.keys[0] === key)) {
        armed = { key, at: now() };
        return "pending";
      }
      const single = SHORTCUTS.find((s) => s.keys.length === 1 && s.keys[0] === key && inScope(s, pathname));
      return single ? single.id : null;
    },
    reset() { armed = null; },
  };
}

/** Page-level shortcuts (J K Enter, digits, A C) are broadcast; the page that owns them listens. */
export const PAGE_SHORTCUT_EVENT = "knowvia:shortcut";

export function useShortcuts(pathname: string, run: (id: string) => void) {
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; });
  useEffect(() => {
    const matcher = createMatcher();
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isEditable(e.target)) return;
      if (e.key.toLowerCase() === "v") return; // hold-V is a state machine in AgentProvider
      const id = matcher.feed(e.key, pathname);
      if (id && id !== "pending") runRef.current(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);
}

/** Subscribe a page to the keys it owns. `handlers` is keyed by shortcut id (next, prev, open, person-1, plan-2, accept, change). */
export function usePageShortcuts(handlers: Partial<Record<string, () => void>>) {
  const ref = useRef(handlers);
  useEffect(() => { ref.current = handlers; });
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      ref.current[id]?.();
    };
    window.addEventListener(PAGE_SHORTCUT_EVENT, on);
    return () => window.removeEventListener(PAGE_SHORTCUT_EVENT, on);
  }, []);
}

/** Tell the page layer a page-scoped key was pressed (used by the shell, and by tests). */
export function pressPageShortcut(id: string) {
  window.dispatchEvent(new CustomEvent(PAGE_SHORTCUT_EVENT, { detail: { id } }));
}

export type KeyRow = { keys: string[]; label: string };
export type KeyGroup = { title: string; rows: KeyRow[] };

const CAP: Record<string, string> = { escape: "Esc", enter: "Enter" };
const cap = (k: string) => CAP[k] ?? (k.length === 1 ? k.toUpperCase() : k);

/** Rows for /shortcuts, built from SHORTCUTS so the page and the overlay never drift from the real keys. */
export function shortcutGroups(): KeyGroup[] {
  const sections: ShortcutSection[] = ["Go to", "Act", "Move", "On a page"];
  return sections.map((title) => {
    const rows: KeyRow[] = [];
    const digits: Record<string, string[]> = {};
    for (const s of SHORTCUTS.filter((x) => x.section === title)) {
      if (/^(person|plan)-\d$/.test(s.id)) { (digits[s.label] ??= []).push(s.keys[0]); continue; }
      rows.push({ keys: s.keys.map(cap), label: s.label.replace(/^Go to /, "") });
      if (s.id === "type") rows.push({ keys: ["⌘K"], label: "Search and actions" });
    }
    for (const [label, ks] of Object.entries(digits)) rows.push({ keys: [`${ks[0]}–${ks[ks.length - 1]}`], label: label === "Pick a plan" ? "Pick a plan on Compare" : "Pick a person" });
    return { title, rows };
  });
}
