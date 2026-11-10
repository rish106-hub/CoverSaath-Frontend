import { runtime, writeSession, json, failure } from "@/server/backend";
import { grantAccess } from "@/server/backend/service";
import { assertSameOrigin } from "@/server/backend/guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { config, client } = runtime();
    const body: unknown = await req.json().catch(() => null);
    const { session, firstName } = await grantAccess(client, body);
    await writeSession(session, config.cookieSecret);
    return json({ ok: true, name: firstName, demo: session.demo === true });
  } catch (e) {
    return failure(e);
  }
}
