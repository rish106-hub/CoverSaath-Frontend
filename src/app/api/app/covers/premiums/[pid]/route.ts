import { deletePremium, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

export const DELETE = (req: Request, { params }: { params: Promise<{ pid: string }> }) => withCovers(req, async (ctx) => deletePremium(ctx, pathId((await params).pid)));
