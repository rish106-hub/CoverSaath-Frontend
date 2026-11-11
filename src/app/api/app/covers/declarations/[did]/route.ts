import { deleteDeclaration, updateDeclaration, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ did: string }> };

export const PUT = (req: Request, { params }: P) =>
  withCovers(req, async (ctx) => updateDeclaration(ctx, pathId((await params).did), await req.json().catch(() => null)));
export const DELETE = (req: Request, { params }: P) => withCovers(req, async (ctx) => deleteDeclaration(ctx, pathId((await params).did)));
