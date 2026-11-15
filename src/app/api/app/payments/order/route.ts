import { withCovers } from "@/server/backend/covers";
import { createOrder } from "@/server/backend/payments";

export const dynamic = "force-dynamic";

/** A Razorpay order for one extra policy: { orderId, amountPaise, currency, keyId }. Never the secret. */
export const POST = (req: Request) => withCovers(req, (ctx) => createOrder(ctx), 201);
