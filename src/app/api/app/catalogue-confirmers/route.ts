import { AppError } from "@/server/backend";
import { designateConfirmerIn } from "@/adapters/evidence-contract";
import { designateConfirmer, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

export const POST = (req: Request) =>
  withEvidence(req, async (ctx) => {
    const parsed = designateConfirmerIn.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return designateConfirmer(ctx, parsed.data.adultUserId);
  }, 201);
