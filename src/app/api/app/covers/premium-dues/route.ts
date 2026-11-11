import { createDue, listDues, withCovers } from "@/server/backend/covers";

export const dynamic = "force-dynamic";

/** Premium dues. Backend: /api/v1/households/{id}/premium-dues (CoverSaath #104). */
export const GET = (req: Request) => {
  const q = new URL(req.url).searchParams;
  return withCovers(req, (ctx) => listDues(ctx, q.get("holdingId"), q.get("state")));
};
export const POST = (req: Request) => withCovers(req, async (ctx) => createDue(ctx, await req.json().catch(() => null)), 201);
