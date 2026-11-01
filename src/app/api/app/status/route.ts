import { runtime, readSession, json, failure } from "@/server/backend";
import { readStatus } from "@/server/backend/service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") return json({ ok: false, code: "NOT_FOUND" }, 404);
  try {
    const { config, client } = runtime();
    const session = await readSession(config.cookieSecret);
    const s = await readStatus(client);
    return json({ ok: s.health && s.ready, ...s, householdId: session?.h });
  } catch (e) {
    return failure(e);
  }
}
