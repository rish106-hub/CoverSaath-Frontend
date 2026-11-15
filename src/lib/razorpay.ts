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

export async function payWithRazorpay(order: PaymentOrder, prefill: { name?: string; email?: string } = {}): Promise<PaymentProof> {
  const Razorpay = await load();
  return new Promise<PaymentProof>((resolve, reject) => {
    let settled = false;
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amountPaise,
      currency: order.currency,
      order_id: order.orderId,
      name: "Knowvia",
      description: "Add another policy",
      prefill,
      handler: (r: RazorpayResponse) => { settled = true; resolve({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }); },
      modal: { ondismiss: () => { if (!settled) reject(new AdapterError("PAYMENT_CANCELLED")); } },
    });
    rzp.on("payment.failed", () => { settled = true; reject(new AdapterError("PAYMENT_FAILED", true)); });
    rzp.open();
  });
}
