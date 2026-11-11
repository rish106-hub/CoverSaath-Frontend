import { getFacts, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** Resolved facts of a holding with their sources, page and printed quote. */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withCovers(req, async (ctx) => getFacts(ctx, pathId((await params).id)));
