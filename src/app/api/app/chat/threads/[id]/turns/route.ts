import { runtime as backendRuntime, readSession, clearSession, failure, AppError } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";
import { readCappedBody } from "@/server/backend/body";
import { createDocumentsClient } from "@/server/backend/documents";
import { streamTurn } from "@/server/backend/chat-v1";
import { pathId } from "@/server/backend/evidence";
import { turnIn } from "@/adapters/chat-contract";

// Node runtime on purpose (no `runtime = 'edge'`): the backend SSE body is passed through, one sanitised event at a time. A Vercel Function
// allows 300 s by default; a turn is cut off after 55 s by the BFF.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A message is at most 1000 characters plus a small procedure block. */
const MAX_TURN_BODY = 8 * 1024;

/** One chat turn. Answers as text/event-stream (meta, delta, answer, done) or a coded JSON error when the turn cannot start. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { config } = backendRuntime();
    const session = await readSession(config.cookieSecret);
    if (!session) throw new AppError(401, "UNAUTHENTICATED");
    if ((req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() !== "application/json") throw new AppError(415, "INVALID_INPUT");
    const threadId = pathId((await params).id);
    const bytes = await readCappedBody(req, MAX_TURN_BODY);
    let raw: unknown = null;
    try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* falls through to INVALID_INPUT */ }
    const parsed = turnIn.safeParse(raw);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    const ctx = { client: createDocumentsClient({ baseUrl: config.apiUrl, strict401: true }), session, state: { h: session.h, exp: session.exp, d: {} }, secret: config.cookieSecret };
    return await streamTurn(ctx, threadId, parsed.data);
  } catch (e) {
    // The backend itself said the token is finished: end the session here too.
    if (e instanceof AppError && e.clearSession) await clearSession().catch(() => undefined);
    return failure(e);
  }
}
