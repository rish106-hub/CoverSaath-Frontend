import { runtime, readAnySession, json, failure, AppError } from "@/server/backend";
import { demoMe } from "@/server/backend/demo";
import { readMe } from "@/server/backend/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { config, client } = runtime();
    const session = await readAnySession(config.cookieSecret);
    if (!session) throw new AppError(401, "UNAUTHENTICATED");
    if (session.demo) return json(demoMe());
    return json(await readMe(client, session));
  } catch (e) {
    return failure(e);
  }
}
