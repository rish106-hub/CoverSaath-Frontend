import { NextResponse, type NextRequest } from "next/server";
import { signInUrl } from "@/lib/return-path";
import { SESSION_COOKIE, SESSION_COOKIE_SECURE } from "@/server/backend/cookie-policy";

/**
 * Cheap first guard: no session cookie, no app page. The cookie is sealed, so only the BFF can say
 * whether it is still valid; the client guard in AppShell handles an expired one. This stops
 * signed-out visitors from loading the page shell and firing requests that can only answer 401.
 */
export function proxy(request: NextRequest) {
  // Mock adapters (local dev and the e2e suite) never set the sealed cookie, so there is nothing to gate on.
  if (process.env.NEXT_PUBLIC_ADAPTERS === "mock") return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE_SECURE) || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, searchParams } = request.nextUrl;
  // The return path is validated (and dropped if unsafe) by the shared helper; only email and name ride along.
  return NextResponse.redirect(new URL(signInUrl({ path: pathname, email: searchParams.get("email"), name: searchParams.get("name") }), request.url));
}

export const config = {
  matcher: [
    "/home/:path*",
    "/policies/:path*",
    "/covers/:path*",
    "/chat/:path*",
    "/upload/:path*",
    "/hospitals/:path*",
    "/stress-test/:path*",
    "/compare/:path*",
    "/review/:path*",
    "/family/:path*",
    "/cards/:path*",
    "/money/:path*",
    "/tools/:path*",
    "/desk/:path*",
    "/emergency/:path*",
    "/assistant/:path*",
    "/shortcuts/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/welcome/:path*",
  ],
};
