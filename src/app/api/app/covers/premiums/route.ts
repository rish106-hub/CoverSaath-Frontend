import { createPremium, listPremiums, withCovers } from "@/server/backend/covers";

export const dynamic = "force-dynamic";

/** Premium payments. Backend: /api/v1/households/{id}/premiums (CoverSaath #104). */
export const GET = (req: Request) => withCovers(req, (ctx) => listPremiums(ctx, new URL(req.url).searchParams.get("holdingId")));
export const POST = (req: Request) => withCovers(req, async (ctx) => createPremium(ctx, await req.json().catch(() => null)), 201);
