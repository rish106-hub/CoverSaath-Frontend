import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError, runtime, writeSession } from "./index";
import { loadConfig, previousCookieSecret } from "./env";
import { expiring, isSecureRequest, oauthCookieName, oauthFlags } from "./cookie-policy";
import { authorizeUrl, exchangeCode, googleConfig, newOAuthStart, openOAuth, readIdToken, redirectUri, sealOAuth, toSignInInput } from "./google";

export type SignInError = "google_unavailable" | "google_denied" | "google_failed" | "google_busy";

const go = (location: string): Response => new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });
const back = (error: SignInError): Response => go(`/signin?error=${error}`);

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const secureFor = (req: Request): boolean =>
  isSecureRequest({ host: req.headers.get("host") ?? new URL(req.url).host, forwardedProto: req.headers.get("x-forwarded-proto") });

/** GET /api/app/auth/google: set the sealed state cookie and send the visitor to Google. */
export async function startGoogle(req: Request): Promise<Response> {
  const cfg = googleConfig();
  if (!cfg) return back("google_unavailable");
  try {
    const { cookieSecret } = loadConfig();
    const start = newOAuthStart();
    // Lax, not Strict: the callback is a top-level navigation from Google, and Strict would drop the cookie.
    (await cookies()).set(oauthCookieName(secureFor(req)), sealOAuth(start, cookieSecret), oauthFlags(secureFor(req)));
    return go(authorizeUrl(cfg, start, redirectUri(req)));
  } catch {
    return back("google_unavailable");
  }
}

/** GET /api/app/auth/google/callback: verify state, exchange the code, ask the backend for a session, set the sealed cookie. */
export async function finishGoogle(req: Request): Promise<Response> {
  const jar = await cookies();
  const secure = secureFor(req);
  const sealed = jar.get(oauthCookieName(secure))?.value;
  jar.set(oauthCookieName(secure), "", expiring({ ...oauthFlags(secure), maxAge: 0 })); // one use, whatever happens next
  const cfg = googleConfig();
  if (!cfg) return back("google_unavailable");
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back("google_denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  try {
    const { config, client } = runtime();
    const saved = openOAuth(sealed, config.cookieSecret, Date.now(), previousCookieSecret());
    if (!saved || !code || !state || code.length > 2048 || !safeEqual(state, saved.s)) return back("google_failed");
    const idToken = await exchangeCode(cfg, { code, verifier: saved.v, redirect: redirectUri(req) });
    const claims = readIdToken(idToken, { clientId: cfg.clientId, nonce: saved.n });
    const signedIn = await client.identitySession(toSignInInput(claims));
    const exp = Math.min(Date.parse(signedIn.expiresAt) || Date.now() + 86_400_000, Date.now() + 7 * 86_400_000);
    await writeSession({ t: signedIn.token, h: signedIn.householdId, m: signedIn.memberId, ...(signedIn.adultUserId ? { a: signedIn.adultUserId } : {}), exp }, config.cookieSecret, secureFor(req));
    return go(signedIn.returning ? "/home" : "/welcome");
  } catch (e) {
    if (e instanceof AppError && e.code === "RATE_LIMITED") return back("google_busy");
    if (e instanceof AppError && e.code === "CONFIG_MISSING") return back("google_unavailable");
    return back("google_failed");
  }
}
