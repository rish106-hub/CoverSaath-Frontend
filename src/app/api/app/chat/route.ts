import { runtime as backendRuntime, readSession, json, failure, AppError } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";
import { createChatClient, chatBody } from "@/server/backend/chat";
import { readCappedBody } from "@/server/backend/body";

/** A chat message is at most 500 characters plus a page path; 4 KB is generous and stops a large body before it is buffered. */
const MAX_CHAT_BODY = 4096;

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
    if ((req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() !== "application/json") throw new AppError(415, "INVALID_INPUT");
    const bytes = await readCappedBody(req, MAX_CHAT_BODY);
    let json_: unknown = null;
    try { json_ = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* invalid JSON falls through to INVALID_INPUT */ }
    const parsed = chatBody.safeParse(json_);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return json({ ok: true, ...(await createChatClient({ baseUrl: config.apiUrl }).ask(session.t, session.h, parsed.data)) });
  } catch (e) {
    return failure(e);
  }
}
