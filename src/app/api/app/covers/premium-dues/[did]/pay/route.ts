import { payDue, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** Marks a due paid by a recorded premium payment. */
export const POST = (req: Request, { params }: { params: Promise<{ did: string }> }) =>
  withCovers(req, async (ctx) => payDue(ctx, pathId((await params).did), await req.json().catch(() => null)));
