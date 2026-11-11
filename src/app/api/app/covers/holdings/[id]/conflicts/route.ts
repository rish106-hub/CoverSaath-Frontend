import { getConflicts, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** Every conflict of a holding, pending and closed, each with both readings and where they came from. */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withCovers(req, async (ctx) => getConflicts(ctx, pathId((await params).id)));
