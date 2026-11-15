import { withCovers } from "@/server/backend/covers";
import { getSlots } from "@/server/backend/payments";

export const dynamic = "force-dynamic";

/** Whether another policy can be added now, and its price when it cannot. */
export const GET = (req: Request) => withCovers(req, (ctx) => getSlots(ctx));
