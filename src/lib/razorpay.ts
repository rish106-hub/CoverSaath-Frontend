// Razorpay Standard Checkout in the browser: loads checkout.js once, opens the payment window for a server-made order and resolves with
// the three ids Checkout returns. The backend verifies the signature; nothing here decides a payment succeeded.
import { AdapterError } from "@/adapters/types";
import type { PaymentOrder, PaymentProof } from "@/adapters/payments";

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: "payment.failed", cb: (r: unknown) => void): void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let loading: Promise<RazorpayCtor> | null = null;
function load(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new AdapterError("PAYMENT_PROVIDER_UNAVAILABLE", true)));
    s.onerror = () => { loading = null; reject(new AdapterError("PAYMENT_PROVIDER_UNAVAILABLE", true)); };
    document.body.appendChild(s);
  });
  return loading;
}

// Closed set of failure reasons chosen by our code. Provider free text is never kept, so it can never reach the screen.
export const PAY_FAIL_REASONS = ["declined", "insufficient_funds", "timed_out", "authentication", "bank_unavailable", "other"] as const;
export type PayFailReason = (typeof PAY_FAIL_REASONS)[number];

// Reads only error.reason, and only when it is a string. Order matters: the first family that matches wins.
export function reasonOf(raw: unknown): PayFailReason {
  const error = (raw as { error?: { reason?: unknown } } | null | undefined)?.error;
  const x = error && typeof error === "object" ? error : null;
  const text = x && typeof x.reason === "string" ? x.reason.toLowerCase() : null;
  if (text === null) return "other";
  const has = (...parts: string[]) => parts.some((part) => text.includes(part));
  if (has("insufficient")) return "insufficient_funds";
  if (has("timed_out", "timeout", "expired")) return "timed_out";
  if (has("otp", "pin", "auth", "3ds")) return "authentication";
  if (has("declin", "risk", "blocked", "not_allowed")) return "declined";
  if (has("bank", "gateway", "server", "technical")) return "bank_unavailable";
  return "other";
}

export async function payWithRazorpay(order: PaymentOrder, prefill: { name?: string; email?: string } = {}): Promise<PaymentProof> {
  const Razorpay = await load();
  return new Promise<PaymentProof>((resolve, reject) => {
    let settled = false;
    // A failed attempt does not end the payment: the window stays open and the person may retry inside it, so a failure is only
    // reported when the window is closed without a later success.
    let lastReason: PayFailReason | null = null;
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amountPaise,
      currency: order.currency,
      order_id: order.orderId,
      name: "Knowvia",
      description: "Add another policy",
      prefill,
      retry: { enabled: true },
      handler: (r: RazorpayResponse) => { settled = true; resolve({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }); },
      modal: {
        ondismiss: () => {
          if (settled) return;
          reject(lastReason ? new AdapterError("PAYMENT_FAILED", true, lastReason) : new AdapterError("PAYMENT_CANCELLED"));
        },
      },
    });
    rzp.on("payment.failed", (r: unknown) => { lastReason = reasonOf(r); });
    rzp.open();
  });
}
