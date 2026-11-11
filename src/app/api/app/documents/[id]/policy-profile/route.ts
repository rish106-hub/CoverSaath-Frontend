import { getPolicyProfile, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** What a document is (product number, insurer, name) as the backend proposes it. Passed through, unverified until the owner confirms. */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withEvidence(req, async (ctx) => getPolicyProfile(ctx, pathId((await params).id)));
