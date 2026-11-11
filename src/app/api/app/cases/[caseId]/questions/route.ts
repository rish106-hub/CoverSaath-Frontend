import { AppError } from "@/server/backend";
import { askQuestionIn } from "@/adapters/evidence-contract";
import { askQuestion, idempotencyKey, pathId, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One question about the case's documents. Needs the reading go-ahead and an Idempotency-Key. */
export const POST = (req: Request, { params }: { params: Promise<{ caseId: string }> }) =>
  withEvidence(req, async (ctx) => {
    const caseId = pathId((await params).caseId);
    const key = idempotencyKey(req);
    const parsed = askQuestionIn.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return askQuestion(ctx, caseId, parsed.data, key);
  });
