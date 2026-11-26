import { getCoverMemory, withCovers } from "@/server/backend/covers";

export const dynamic = "force-dynamic";

/** The household's cover memory (14 sections across every policy) as `{ markdown }`. Backend: GET /api/v1/households/{id}/cover-memory. */
export const GET = (req: Request) => withCovers(req, (ctx) => getCoverMemory(ctx));
