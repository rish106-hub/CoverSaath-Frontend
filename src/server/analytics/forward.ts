import "server-only";
import type { AnalyticsConfig } from "./config";
import { isEventName, sanitizeProperties } from "./policy";

const MAX_BODY_BYTES = 1024;
const TIMEOUT_MS = 2000;

export type IngestResult = "forwarded" | "dropped" | "invalid";

/**
 * Validate one browser event and forward it. Order matters: parse, allow-list, then build the outbound body from
 * scratch (never spreading anything from the request). Network failure is swallowed: analytics must not break the app.
 */
export async function forwardEvent(raw: string, distinctId: string, cfg: AnalyticsConfig, fetchImpl: typeof fetch = fetch): Promise<IngestResult> {
  if (raw.length > MAX_BODY_BYTES) return "invalid";
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return "invalid"; }
  if (typeof body !== "object" || body === null) return "invalid";
  const { event, properties } = body as { event?: unknown; properties?: unknown };
  if (!isEventName(event)) return "invalid";
  const props = sanitizeProperties(event, properties);
  const outbound = {
    api_key: cfg.key,
    event,
    distinct_id: distinctId,
    properties: { ...props, $process_person_profile: false, $geoip_disable: true, $lib: "knowvia-server-proxy" },
    timestamp: new Date().toISOString(),
  };
  try {
    // No cookies, no forwarded IP, no user agent, no referrer: only the body above is sent.
    const res = await fetchImpl(`${cfg.host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(outbound),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    return res.ok ? "forwarded" : "dropped";
  } catch {
    return "dropped";
  }
}
