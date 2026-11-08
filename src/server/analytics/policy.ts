import "server-only";

/**
 * Analytics allow-list. Nothing leaves this app for PostHog unless the event name AND every property key AND every
 * property value is declared here. There is no free text, no identifier, no URL, no policy or household content.
 * Adding an event or property is a deliberate edit to this file, covered by tests/server/analytics.test.ts.
 */

/** App pages, by route id only (never a path with ids, never a query string). */
export const PAGES = [
  "home", "policies", "policy", "stress-test", "compare", "review", "family", "cards", "money", "tools", "desk",
  "emergency", "assistant", "shortcuts", "settings", "profile", "welcome", "signin",
] as const;

export const FEATURES = ["voice", "search", "theme-toggle", "compare", "stress-test", "export", "shortcut-help"] as const;

type Spec = readonly string[] | "boolean";

/** event -> property -> allowed values. Strings are enums only. */
export const EVENTS = {
  page_view: { page: PAGES, viewport: ["small", "medium", "large"], theme: ["light", "dark"] },
  feature_used: { feature: FEATURES, page: PAGES },
  action_failed: { page: PAGES, retryable: "boolean" },
} as const satisfies Record<string, Record<string, Spec>>;

export type EventName = keyof typeof EVENTS;

export function isEventName(v: unknown): v is EventName {
  return typeof v === "string" && Object.hasOwn(EVENTS, v);
}

/** Keep only declared properties whose value is declared. Everything else is dropped, never forwarded. */
export function sanitizeProperties(event: EventName, input: unknown): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) return out;
  const spec: Record<string, Spec> = EVENTS[event];
  for (const [key, allowed] of Object.entries(spec)) {
    if (!Object.hasOwn(input, key)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (allowed === "boolean") {
      if (typeof value === "boolean") out[key] = value;
    } else if (typeof value === "string" && allowed.includes(value)) {
      out[key] = value;
    }
  }
  return out;
}
