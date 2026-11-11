import { listHoldings, withCovers } from "@/server/backend/covers";

export const dynamic = "force-dynamic";

/** The household's holdings (one per added document): id, document id, kind, status. */
export const GET = (req: Request) => withCovers(req, (ctx) => listHoldings(ctx));
