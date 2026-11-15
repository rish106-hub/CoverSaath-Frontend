import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import { need, type Ctx } from "./documents";

// BFF for paid policy slots (CoverSaath migration 067): the first policy is free, each further policy costs one Razorpay payment.
// The backend creates the order and verifies the Checkout signature with the key secret; this layer only passes ids through. Only the
// public key id reaches the browser.
const enc = encodeURIComponent;
const ID = /^[A-Za-z0-9_]{1,100}$/;

export const slotsOut = z.object({
  enabled: z.boolean(), used: z.number().int(), allowed: z.number().int(), canAdd: z.boolean(), pricePaise: z.number().int(), currency: z.string(),
});
export const orderOut = z.object({ orderId: z.string().regex(ID), amountPaise: z.number().int(), currency: z.string(), keyId: z.string().regex(/^rzp_[A-Za-z0-9_]+$/) });
const verifyIn = z.object({ orderId: z.string().regex(ID), paymentId: z.string().regex(ID), signature: z.string().regex(/^[0-9a-f]{64}$/) }).strict();

const shape = <T extends z.ZodType>(schema: T, body: unknown): z.output<T> => {
  const r = schema.safeParse(body);
  if (!r.success) throw new AppError(502, "BACKEND_BAD_RESPONSE");
  return r.data;
};

export async function getSlots(ctx: Ctx): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("GET", `/api/v1/households/${enc(ctx.session.h)}/policy-slots`, ctx.session.t);
  return { data: shape(slotsOut, r.body) };
}

export async function createOrder(ctx: Ctx): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", `/api/v1/households/${enc(ctx.session.h)}/policy-slots/orders`, ctx.session.t, { json: {}, timeoutMs: 15_000 });
  return { data: shape(orderOut, r.body) };
}

export async function verifyPayment(ctx: Ctx, body: unknown): Promise<{ data: unknown }> {
  need(ctx.session);
  const parsed = verifyIn.safeParse(body);
  if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
  const r = await ctx.client.send("POST", `/api/v1/households/${enc(ctx.session.h)}/policy-slots/verify`, ctx.session.t, { json: parsed.data });
  return { data: shape(slotsOut.extend({ paid: z.literal(true) }), r.body) };
}
