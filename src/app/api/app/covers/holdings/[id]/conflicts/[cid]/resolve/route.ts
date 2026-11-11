import { AppError } from "@/server/backend";
import { resolveConflictIn } from "@/adapters/covers-contract";
import { resolveConflict, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** The owner chooses which reading is right. Body: { chosenFactId, alternativeIndex? }. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string; cid: string }> }) =>
  withCovers(req, async (ctx) => {
    const { id, cid } = await params;
    const holdingId = pathId(id);
    const conflictId = pathId(cid);
    const parsed = resolveConflictIn.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return resolveConflict(ctx, holdingId, conflictId, parsed.data);
  });
