import { getCandidates, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Up to three insurer and product guesses for the holding's document. Names only; the UIN never leaves the backend. */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withCovers(req, async (ctx) => getCandidates(ctx, pathId((await params).id)));
