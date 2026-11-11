import { AppError } from "@/server/backend";
import { handoffQueryIn } from "@/adapters/evidence-contract";
import { getHandoff, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

export const GET = (req: Request, { params }: { params: Promise<{ caseId: string }> }) =>
  withEvidence(req, async (ctx) => {
    const caseId = pathId((await params).caseId);
    const url = new URL(req.url);
    const q = handoffQueryIn.safeParse({ answerId: url.searchParams.get("answerId"), asOf: url.searchParams.get("asOf"), memberId: url.searchParams.get("memberId") });
    if (!q.success) throw new AppError(400, "INVALID_INPUT");
    return getHandoff(ctx, caseId, { answerId: q.data.answerId ?? undefined, asOf: q.data.asOf ?? undefined, memberId: q.data.memberId ?? undefined });
  });
