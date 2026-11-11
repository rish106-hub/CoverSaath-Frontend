import { AppError } from "@/server/backend";
import { catalogueReviewIn } from "@/adapters/evidence-contract";
import { idempotencyKey, pathId, reviewCatalogue, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

export const POST = (req: Request, { params }: { params: Promise<{ caseId: string }> }) =>
  withEvidence(req, async (ctx) => {
    const caseId = pathId((await params).caseId);
    const key = idempotencyKey(req);
    const parsed = catalogueReviewIn.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return reviewCatalogue(ctx, caseId, parsed.data, key);
  });
