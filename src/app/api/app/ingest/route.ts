import { failure } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";
import { analyticsConfig } from "@/server/analytics/config";
import { readConsent } from "@/server/analytics/consent";
import { forwardEvent } from "@/server/analytics/forward";
import { AppError } from "@/server/backend/errors";

export const dynamic = "force-dynamic";

const noContent = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

/**
 * Analytics proxy. The browser posts here and never talks to PostHog. Flag off or no consent: 204 and nothing is read
 * or sent. Only allow-listed events and properties are forwarded (src/server/analytics/policy.ts).
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const cfg = analyticsConfig();
    if (!cfg) return noContent();
    const consent = readConsent(req);
    if (!consent.granted) return noContent();
    const result = await forwardEvent(await req.text(), consent.id, cfg);
    if (result === "invalid") throw new AppError(400, "INVALID_INPUT");
    return noContent();
  } catch (e) {
    return failure(e);
  }
}
