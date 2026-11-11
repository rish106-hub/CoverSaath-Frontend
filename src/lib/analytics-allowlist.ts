/**
 * Mirror of the backend's server-side analytics allowlist (CoverSaath `src/contracts/analytics-events.js`, ADR 0033).
 * The backend emits these nine events from the worker's outbox, only for a household with an active analytics grant and only
 * while its `ANALYTICS_ENABLED` is exactly "true". The app never sends them itself: this file exists so the app and the backend
 * cannot drift (tests/lib/analytics-allowlist.test.ts compares it with tests/fixtures/backend-analytics-events.json, a snapshot of
 * the backend contract) and so the consent scope for the backend grant is named in one place.
 *
 * Browser-side analytics (page_view, feature_used, action_failed) is a separate channel with its own allow-list:
 * src/server/analytics/policy.ts. FOR LEGAL REVIEW: purpose, notice and consent wording are not final.
 */
export const BACKEND_ANALYTICS_PURPOSE = "analytics";

/** The household-wide scope that opens the backend's analytics purpose (resourceId is always null). */
export const BACKEND_ANALYTICS_CONSENT_SCOPE = {
  resourceType: "household",
  resourceId: null,
  action: "share",
  dataCategory: "usage_events",
  recipient: "posthog",
} as const;

type Enum = { readonly kind: "enum"; readonly values: readonly string[] };
type Count = { readonly kind: "count"; readonly max: number };
type Flag = { readonly kind: "boolean" };
type Shape = Enum | Count | Flag;

const oneOf = (...values: string[]): Enum => ({ kind: "enum", values });
const count = (max: number): Count => ({ kind: "count", max });
const flag: Flag = { kind: "boolean" };

export const BACKEND_ANALYTICS_EVENTS = {
  cover_uploaded: { kind: oneOf("policy_wording", "policy_schedule", "endorsement", "member_card"), pages: count(2000) },
  insurer_confirmed: { candidate_rank: count(3), manual: flag },
  parse_completed: { facts: count(10_000), conflicts: count(10_000), ms: count(86_400_000) },
  conflict_resolved: { choice: oneOf("primary", "alternative") },
  declaration_added: { kind: oneOf("pre_existing_disease", "prior_condition", "habit", "occupation", "nominee", "other") },
  premium_recorded: {
    channel: oneOf("upi", "card", "netbanking", "cheque", "cash", "salary_deduction", "unknown"),
    via: oneOf("self", "agent", "employer", "bank"),
  },
  chat_turn: {
    intent: oneOf("coverage_question", "waiting_period", "sub_limit", "procedure_planning", "claim_process", "premium_due", "document_help", "general", "unknown"),
    provider: oneOf("none", "anthropic", "gemini", "deepseek", "kimi", "openai"),
    tokens: count(10_000_000),
    ms: count(3_600_000),
    facts_used: count(1000),
  },
  voice_turn: { seconds: count(3600) },
  hospital_search: { results: count(1000) },
} as const satisfies Record<string, Record<string, Shape>>;

export type BackendAnalyticsEvent = keyof typeof BACKEND_ANALYTICS_EVENTS;

/** Same rule as the backend: an unlisted event or key, or a value outside its shape, is not valid. Counts clamp to their maximum. */
export function sanitizeBackendAnalyticsEvent(event: string, properties: unknown): Record<string, string | number | boolean> | null {
  if (!Object.hasOwn(BACKEND_ANALYTICS_EVENTS, event)) return null;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) return null;
  const spec: Record<string, Shape> = BACKEND_ANALYTICS_EVENTS[event as BackendAnalyticsEvent];
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    const shape = Object.hasOwn(spec, key) ? spec[key] : undefined;
    if (!shape) return null;
    if (shape.kind === "enum") {
      if (typeof value !== "string" || !shape.values.includes(value)) return null;
      out[key] = value;
    } else if (shape.kind === "count") {
      if (!Number.isInteger(value) || (value as number) < 0) return null;
      out[key] = Math.min(value as number, shape.max);
    } else {
      if (typeof value !== "boolean") return null;
      out[key] = value;
    }
  }
  return out;
}
