// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdapterError } from "@/adapters/types";
import { PAY_FAIL_REASONS, payWithRazorpay, reasonOf } from "@/lib/razorpay";

const order = { orderId: "order_1", amountPaise: 19900, currency: "INR", keyId: "key_synthetic" };
const failure = (reason: unknown) => ({ error: { reason, description: "Provider text that must never be kept", code: "BAD_REQUEST_ERROR", source: "bank", step: "payment_authentication", metadata: { payment_id: "pay_x" } } });

type Fake = { options: Record<string, any>; onFailed: ((r: unknown) => void) | null };
let fake: Fake;

beforeEach(() => {
  fake = { options: {}, onFailed: null };
  (window as any).Razorpay = class {
    constructor(options: Record<string, unknown>) { fake.options = options; }
    on(_event: string, cb: (r: unknown) => void) { fake.onFailed = cb; }
    open() {}
  };
});
afterEach(() => { delete (window as any).Razorpay; });

const start = () => {
  const promise = payWithRazorpay(order);
  const outcome = promise.then((v) => ({ ok: v }), (e) => ({ err: e as AdapterError }));
  // load() is async, so let the constructor run before the test drives the callbacks.
  const ready = new Promise<void>((r) => setTimeout(r, 0));
  return { outcome, ready };
};
const pay = { razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: "sig_1" };

describe("razorpay", () => {
  it("reasonOf maps each known family and falls back to other", () => {
    const cases: [string, string][] = [
      ["insufficient_funds", "insufficient_funds"], ["payment_timed_out", "timed_out"], ["gateway_timeout", "timed_out"], ["Session EXPIRED", "timed_out"],
      ["wrong_otp", "authentication"], ["invalid_pin", "authentication"], ["auth_failed", "authentication"], ["3ds_failed", "authentication"],
      ["card_declined", "declined"], ["risk_check", "declined"], ["card_blocked", "declined"], ["txn_not_allowed", "declined"],
      ["bank_down", "bank_unavailable"], ["server_error", "bank_unavailable"], ["technical_issue", "bank_unavailable"],
      ["something else", "other"],
    ];
    for (const [raw, expected] of cases) expect(reasonOf(failure(raw))).toBe(expected);
    for (const r of PAY_FAIL_REASONS) expect(PAY_FAIL_REASONS).toContain(r);
  });

  it("reasonOf ignores description, code and non-string reasons", () => {
    expect(reasonOf({ error: { description: "insufficient funds", code: "declined" } })).toBe("other");
    expect(reasonOf({ error: { reason: 42, description: "bank declined" } })).toBe("other");
    expect(reasonOf({ error: { reason: null } })).toBe("other");
    expect(reasonOf({ error: null })).toBe("other");
    expect(reasonOf(null)).toBe("other");
    expect(reasonOf(undefined)).toBe("other");
    expect(reasonOf("insufficient")).toBe("other");
  });

  it("resolves with the three ids when the handler fires", async () => {
    const { outcome, ready } = start();
    await ready;
    fake.options.handler(pay);
    expect(await outcome).toEqual({ ok: { orderId: "order_1", paymentId: "pay_1", signature: "sig_1" } });
  });

  it("a failure does not settle; closing the window after it rejects PAYMENT_FAILED with the reason", async () => {
    const { outcome, ready } = start();
    await ready;
    fake.onFailed!(failure("insufficient_funds"));
    let settledEarly = false;
    void outcome.then(() => { settledEarly = true; });
    await new Promise((r) => setTimeout(r, 5));
    expect(settledEarly).toBe(false);
    fake.options.modal.ondismiss();
    const result = (await outcome) as { err: AdapterError };
    expect(result.err).toMatchObject({ code: "PAYMENT_FAILED", retryable: true, reason: "insufficient_funds" });
  });

  it("a failure followed by a success in the same window resolves with the proof", async () => {
    const { outcome, ready } = start();
    await ready;
    fake.onFailed!(failure("card_declined"));
    fake.options.handler(pay);
    fake.options.modal.ondismiss();
    expect(await outcome).toEqual({ ok: { orderId: "order_1", paymentId: "pay_1", signature: "sig_1" } });
  });

  it("closing the window with no failure rejects PAYMENT_CANCELLED", async () => {
    const { outcome, ready } = start();
    await ready;
    fake.options.modal.ondismiss();
    const result = (await outcome) as { err: AdapterError };
    expect(result.err).toMatchObject({ code: "PAYMENT_CANCELLED", retryable: false, reason: null });
  });

  it("the rejected error carries no provider text", async () => {
    const { outcome, ready } = start();
    await ready;
    fake.onFailed!(failure("bank_down"));
    fake.options.modal.ondismiss();
    const result = (await outcome) as { err: AdapterError };
    const everything = JSON.stringify({ ...result.err, message: result.err.message });
    expect(everything).not.toContain("Provider text");
    expect(everything).not.toContain("BAD_REQUEST_ERROR");
    expect(everything).not.toContain("payment_authentication");
    expect(everything).not.toContain("pay_x");
    expect(result.err.reason).toBe("bank_unavailable");
  });

  it("passes retry enabled and the order fields to Razorpay", async () => {
    const { ready } = start();
    await ready;
    expect(fake.options).toMatchObject({
      key: "key_synthetic", amount: 19900, currency: "INR", order_id: "order_1",
      description: "Add another policy", retry: { enabled: true },
    });
  });
});
