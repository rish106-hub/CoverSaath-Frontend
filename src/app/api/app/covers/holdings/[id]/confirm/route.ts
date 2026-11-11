import { AppError } from "@/server/backend";
import { confirmProductIn } from "@/adapters/covers-contract";
import { confirmProduct, withCovers } from "@/server/backend/covers";
import { idempotencyKey, pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** The owner picks one candidate. Needs an Idempotency-Key and the profile version the person last saw. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withCovers(req, async (ctx) => {
    const holdingId = pathId((await params).id);
    const key = idempotencyKey(req);
    const parsed = confirmProductIn.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return confirmProduct(ctx, holdingId, parsed.data, key);
  });
