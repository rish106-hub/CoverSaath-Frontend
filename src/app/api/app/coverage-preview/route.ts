import { AppError } from "@/server/backend";
import { coveragePreviewIn } from "@/adapters/evidence-contract";
import { coveragePreview, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = (req: Request) =>
  withEvidence(req, async (ctx) => {
    const parsed = coveragePreviewIn.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return coveragePreview(ctx, parsed.data);
  });
