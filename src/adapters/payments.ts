import { AdapterError } from "./types";
import { useBackend } from "./mode";
import { fetchWithRetry } from "@/lib/retry-fetch";

// Paid policy slots, browser side. The BFF holds the backend token; the backend creates the Razorpay order and verifies the payment.
export type PolicySlots = { enabled: boolean; used: number; allowed: number; canAdd: boolean; pricePaise: number; currency: string };
export type PaymentOrder = { orderId: string; amountPaise: number; currency: string; keyId: string };
export type PaymentProof = { orderId: string; paymentId: string; signature: string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithRetry(path, { ...init, cache: "no-store", headers: { "content-type": "application/json", "x-knowvia-app": "1", ...init?.headers } });
  } catch {
    throw new AdapterError("BACKEND_UNREACHABLE", true);
  }
  const body = (await res.json().catch(() => null)) as { data?: T; code?: string; retryable?: boolean } | null;
  if (!res.ok) throw new AdapterError(body?.code ?? "BACKEND_REJECTED", body?.retryable === true);
  return body?.data as T;
}

const FREE: PolicySlots = { enabled: false, used: 0, allowed: 1, canAdd: true, pricePaise: 19900, currency: "INR" };

export const payments = {
  slots: (): Promise<PolicySlots> => (useBackend ? call<PolicySlots>("/api/app/payments/slots") : Promise.resolve(FREE)),
  order: (): Promise<PaymentOrder> => call<PaymentOrder>("/api/app/payments/order", { method: "POST", body: "{}" }),
  verify: (proof: PaymentProof): Promise<PolicySlots> => call<PolicySlots>("/api/app/payments/verify", { method: "POST", body: JSON.stringify(proof) }),
};
