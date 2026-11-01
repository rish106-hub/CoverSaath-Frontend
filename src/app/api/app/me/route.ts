import { runtime, readSession, json, failure, AppError } from "@/server/backend";
import { readMe } from "@/server/backend/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { config, client } = runtime();
    const session = await readSession(config.cookieSecret);
    if (!session) throw new AppError(401, "UNAUTHENTICATED");
    return json(await readMe(client, session));
  } catch (e) {
    return failure(e);
  }
}
