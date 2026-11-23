import { confirmReading, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** The owner confirms a printed reading. No request body: the backend copies the value itself and rejects any field. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string; factId: string }> }) =>
  withCovers(req, async (ctx) => {
    const { id, factId } = await params;
    return confirmReading(ctx, pathId(id), pathId(factId));
  });
