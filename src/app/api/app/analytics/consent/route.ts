import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";
import { AppError } from "@/server/backend/errors";
import { expiring, type CookieFlags } from "@/server/backend/cookie-policy";
import { CONSENT_MAX_AGE_S, consentCookieName, newAnonymousId, readConsent, requestIsSecure } from "@/server/analytics/consent";

export const dynamic = "force-dynamic";

const body = z.object({ choice: z.enum(["granted", "denied"]) }).strict();

const flags = (secure: boolean): CookieFlags => ({ httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: CONSENT_MAX_AGE_S });

/** Records the person's analytics choice. Granting sets the cookie; denying clears it. Withdrawal is always possible. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    const secure = requestIsSecure(req);
    const name = consentCookieName(secure);
    const res = NextResponse.json({ ok: true, analytics: parsed.data.choice }, { headers: { "cache-control": "no-store" } });
    if (parsed.data.choice === "granted") {
      const existing = readConsent(req);
      res.cookies.set(name, `granted.${existing.granted ? existing.id : newAnonymousId()}`, flags(secure));
    } else {
      res.cookies.set(name, "", expiring(flags(secure)));
    }
    return res;
  } catch (e) {
    return failure(e);
  }
}
