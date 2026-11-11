import { getAnswer, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

export const GET = (req: Request, { params }: { params: Promise<{ caseId: string; answerId: string }> }) =>
  withEvidence(req, async (ctx) => {
    const p = await params;
    return getAnswer(ctx, pathId(p.caseId), pathId(p.answerId));
  });
