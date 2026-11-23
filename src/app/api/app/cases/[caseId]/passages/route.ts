import { getPassages, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** Passages for a short query, in two lists: the person's own documents, and the insurer's wording (labelled, never merged). */
export const GET = (req: Request, { params }: { params: Promise<{ caseId: string }> }) =>
  withEvidence(req, async (ctx) => {
    const { searchParams } = new URL(req.url);
    return getPassages(ctx, pathId((await params).caseId), searchParams.get("q"), searchParams.get("limit"));
  });
