import { runtime as backendRuntime, readSession, json, failure, AppError } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";
import { createChatClient, chatBody } from "@/server/backend/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Ask Knowvia, backed by the CoverSaath chat route. readSession (not readAnySession): a demo session gets a coded 403 and stays on the mock. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { config } = backendRuntime();
    const session = await readSession(config.cookieSecret);
    if (!session) throw new AppError(401, "UNAUTHENTICATED");
    const parsed = chatBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return json({ ok: true, ...(await createChatClient({ baseUrl: config.apiUrl }).ask(session.t, session.h, parsed.data)) });
  } catch (e) {
    return failure(e);
  }
}
