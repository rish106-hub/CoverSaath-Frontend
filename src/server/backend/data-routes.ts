import "server-only";
import { runtime, readSession, json } from "./index";
import { DataError, createSender, dataFailure, type Send } from "./data-http";
import { assertSameOrigin } from "./guard";
import type { SessionPayload } from "./session";

/** Common wrapper for the data routes: same-origin guard for writes, sealed session, coded failures. */
export async function withData(req: Request, run: (ctx: { send: Send; session: SessionPayload }) => Promise<unknown>, status = 200): Promise<Response> {
  try {
    assertSameOrigin(req);
    const { config } = runtime();
    const session = await readSession(config.cookieSecret);
    if (!session) throw new DataError(401, "UNAUTHENTICATED");
    const out = await run({ send: createSender({ baseUrl: config.apiUrl }), session });
    return json({ ok: true, ...(out && typeof out === "object" ? out : {}) }, status);
  } catch (e) {
    return dataFailure(e);
  }
}
