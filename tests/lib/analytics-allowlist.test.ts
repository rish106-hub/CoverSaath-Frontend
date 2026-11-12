import { describe, expect, it } from "vitest";
import snapshot from "../fixtures/backend-analytics-events.json";
import { BACKEND_ANALYTICS_CONSENT_SCOPE, BACKEND_ANALYTICS_EVENTS, BACKEND_ANALYTICS_PURPOSE, sanitizeBackendAnalyticsEvent } from "@/lib/analytics-allowlist";

// The snapshot is the backend contract (CoverSaath src/contracts/analytics-events.js, ADR 0033) serialised as JSON. When the backend
// allowlist changes, regenerate the snapshot from it and update the mirror in the same change; this test is the drift alarm.
describe("backend analytics allowlist mirror", () => {
  it("equals the backend snapshot exactly (events, shapes, purpose and consent scope)", () => {
    expect(JSON.parse(JSON.stringify(BACKEND_ANALYTICS_EVENTS))).toEqual(snapshot.events);
    expect(BACKEND_ANALYTICS_PURPOSE).toBe(snapshot.purpose);
    expect({ ...BACKEND_ANALYTICS_CONSENT_SCOPE, resourceId: undefined }).toEqual({ ...snapshot.consentScope, resourceId: undefined });
    expect(BACKEND_ANALYTICS_CONSENT_SCOPE.recipient).toBe(snapshot.recipient);
  });

  it("is exactly the nine planned events", () => {
    expect(Object.keys(BACKEND_ANALYTICS_EVENTS).sort()).toEqual([
      "chat_turn", "conflict_resolved", "cover_uploaded", "declaration_added", "hospital_search", "insurer_confirmed", "parse_completed", "premium_recorded", "voice_turn",
    ]);
  });

  it("has no free-text shape and no key that could carry a name, id, number or amount", () => {
    for (const spec of Object.values(BACKEND_ANALYTICS_EVENTS)) {
      for (const [key, shape] of Object.entries(spec)) {
        expect(["enum", "count", "boolean"]).toContain(shape.kind);
        expect(key).not.toMatch(/^(?:.*(?:name|email|phone|mobile|uin|number|amount|text|message|url|path)|.*id)$/i);
      }
    }
  });

  it("accepts allowlisted properties, clamps counts, rejects anything else", () => {
    expect(sanitizeBackendAnalyticsEvent("cover_uploaded", { kind: "policy_wording", pages: 12 })).toEqual({ kind: "policy_wording", pages: 12 });
    expect(sanitizeBackendAnalyticsEvent("voice_turn", { seconds: 99_999 })).toEqual({ seconds: 3600 });
    for (const [event, props] of [
      ["cover_uploaded", { kind: "policy_wording", filename: "x.pdf" }],
      ["cover_uploaded", { kind: "my policy for Asha" }],
      ["premium_recorded", { channel: "upi", via: "self", amount: 1200 }],
      ["parse_completed", { facts: 1.5 }],
      ["insurer_confirmed", { manual: "yes" }],
      ["not_an_event", {}],
      ["__proto__", {}],
    ] as const) expect(sanitizeBackendAnalyticsEvent(event, props)).toBeNull();
    expect(sanitizeBackendAnalyticsEvent("voice_turn", null)).toBeNull();
    expect(sanitizeBackendAnalyticsEvent("voice_turn", [])).toBeNull();
  });
});
