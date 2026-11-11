import { getDeletionInventory, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** What is still held for the case. Works after the reading consent is withdrawn, so the person can still delete it. */
export const GET = (req: Request, { params }: { params: Promise<{ caseId: string }> }) =>
  withEvidence(req, async (ctx) => getDeletionInventory(ctx, pathId((await params).caseId)));
