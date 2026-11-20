import { getMemoryDocument, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** The owner's memory document (policy.md) for one holding, as `{ holdingId, markdown }`. Backend: GET /api/v1/holdings/{id}/memory-document. */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withCovers(req, async (ctx) => getMemoryDocument(ctx, pathId((await params).id)));
