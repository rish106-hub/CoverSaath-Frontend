import { runtime, readAnySession, clearSession, json, failure } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { config, client } = runtime();
    const session = await readAnySession(config.cookieSecret);
    if (session && !session.demo) await client.revoke(session.t).catch(() => undefined);
    await clearSession();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
