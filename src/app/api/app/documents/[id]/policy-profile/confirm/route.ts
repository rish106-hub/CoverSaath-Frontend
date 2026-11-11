import { AppError } from "@/server/backend";
import { confirmPolicyProfileIn } from "@/adapters/evidence-contract";
import { confirmPolicyProfile, idempotencyKey, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** The owner's statement of what the document is. Needs an Idempotency-Key and the version the person last saw. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withEvidence(req, async (ctx) => {
    const documentId = pathId((await params).id);
    const key = idempotencyKey(req);
    const parsed = confirmPolicyProfileIn.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return confirmPolicyProfile(ctx, documentId, parsed.data, key);
  });
