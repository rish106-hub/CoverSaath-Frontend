import { premiumsRoute, withCovers } from "@/server/backend/covers";

export const dynamic = "force-dynamic";

// BACKEND ROUTE MISSING: answers NOT_AVAILABLE (501) after checking input. See src/server/backend/covers.ts.
export const GET = (req: Request) => withCovers(req, (ctx) => premiumsRoute(ctx, "GET", null));
export const POST = (req: Request) => withCovers(req, async (ctx) => premiumsRoute(ctx, "POST", await req.json().catch(() => null)), 201);
