import { createDeclaration, listDeclarations, withCovers } from "@/server/backend/covers";

export const dynamic = "force-dynamic";

/** Member declarations. Backend: /api/v1/households/{id}/declarations (CoverSaath #104). */
export const GET = (req: Request) => withCovers(req, (ctx) => listDeclarations(ctx, new URL(req.url).searchParams.get("memberId")));
export const POST = (req: Request) => withCovers(req, async (ctx) => createDeclaration(ctx, await req.json().catch(() => null)), 201);
