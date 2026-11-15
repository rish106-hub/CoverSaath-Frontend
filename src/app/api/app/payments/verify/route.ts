import { withCovers } from "@/server/backend/covers";
import { verifyPayment } from "@/server/backend/payments";

export const dynamic = "force-dynamic";

/** { orderId, paymentId, signature } from Checkout. The backend checks the signature; only then is the slot paid. */
export const POST = (req: Request) => withCovers(req, async (ctx) => verifyPayment(ctx, await req.json().catch(() => null)));
