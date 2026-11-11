import { getSourcePack, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

export const GET = (req: Request, { params }: { params: Promise<{ caseId: string }> }) =>
  withEvidence(req, async (ctx) => getSourcePack(ctx, pathId((await params).caseId)));
