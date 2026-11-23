import { getHoldingPassages, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** Passages for a short query on one holding's case: own documents, and (apart) the insurer's wording. */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withEvidence(req, async (ctx) => {
    const { searchParams } = new URL(req.url);
    return getHoldingPassages(ctx, pathId((await params).id), searchParams.get("q"), searchParams.get("limit"));
  });
