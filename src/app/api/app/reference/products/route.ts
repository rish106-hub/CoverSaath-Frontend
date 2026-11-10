import { runtime as backendRuntime, readSession, json, failure, AppError } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";
import { createReferenceClient, readReferenceQuery } from "@/server/backend/reference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public product reference lookup. readSession (not readAnySession): a demo session gets a coded 403 and stays on the mock. */
export async function GET(req: Request) {
  try {
    assertSameOrigin(req);
    const { config } = backendRuntime();
    const session = await readSession(config.cookieSecret);
    if (!session) throw new AppError(401, "UNAUTHENTICATED");
    const query = readReferenceQuery(req);
    return json({ ok: true, ...(await createReferenceClient({ baseUrl: config.apiUrl }).products(session.t, query)) });
  } catch (e) {
    return failure(e);
  }
}
