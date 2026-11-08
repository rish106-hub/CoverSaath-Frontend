import { runtime, writeSession, json, failure, AppError } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";
import { DEMO_SESSION_MS, demoCredentialsMatch, demoEnabled, demoNoteFailure, demoRateLimited } from "@/server/backend/demo";

export const dynamic = "force-dynamic";

/** Public demo login. Off unless DEMO_LOGIN_ENABLED=true. Opens a sealed session with no backend token and no backend call. */
export async function POST(req: Request) {
  try {
    if (!demoEnabled()) throw new AppError(404, "NOT_FOUND");
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (demoRateLimited(ip)) throw new AppError(429, "RATE_LIMITED", true, 600);
    const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
    if (!demoCredentialsMatch(body?.email, body?.password)) {
      demoNoteFailure(ip);
      throw new AppError(401, "UNAUTHENTICATED");
    }
    const { config } = runtime();
    await writeSession({ t: "", h: "demo", m: "demo", exp: Date.now() + DEMO_SESSION_MS, demo: true }, config.cookieSecret);
    return json({ ok: true, name: "Meera" });
  } catch (e) {
    return failure(e);
  }
}
