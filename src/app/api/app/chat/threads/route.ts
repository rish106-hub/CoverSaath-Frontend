import { withCovers } from "@/server/backend/covers";
import { createThread } from "@/server/backend/chat-v1";
import { readCappedBody } from "@/server/backend/body";
import { AppError } from "@/server/backend";
import { PATH_ID } from "@/adapters/covers-contract";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ holdingId: z.string().regex(PATH_ID).max(128).nullish() }).strict();

/** Starts a chat thread for the signed-in household, optionally about one cover. The household id comes from the session, never from the page. */
export const POST = (req: Request) =>
  withCovers(req, async (ctx) => {
    let raw: unknown = {};
    const bytes = await readCappedBody(req, 1024);
    if (bytes.byteLength > 0) {
      try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError(400, "INVALID_INPUT"); }
    }
    const p = body.safeParse(raw);
    if (!p.success) throw new AppError(400, "INVALID_INPUT");
    return createThread(ctx, p.data.holdingId ?? null);
  }, 201);
