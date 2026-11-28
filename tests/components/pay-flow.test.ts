import { describe, expect, it, vi } from "vitest";
import type { PaymentOrder, PaymentProof, PolicySlots } from "@/adapters/payments";
import { AdapterError } from "@/adapters/types";
import { SLOT_TRIES, SLOT_WAIT_MS, VERIFY_TRIES, VERIFY_WAIT_MS, confirmPay, payCopy, runPay } from "@/components/covers/pay-flow";
import type { PayDeps, PayState } from "@/components/covers/pay-flow";

const order: PaymentOrder = { orderId: "order_1", amountPaise: 19900, currency: "INR", keyId: "key_synthetic" };
const proof: PaymentProof = { orderId: "order_1", paymentId: "pay_1", signature: "sig_1" };
const free: PolicySlots = { enabled: true, used: 1, allowed: 2, canAdd: true, pricePaise: 19900, currency: "INR" };
const full: PolicySlots = { ...free, used: 2, canAdd: false };

const deps = (over: Partial<PayDeps> = {}): PayDeps & { wait: ReturnType<typeof vi.fn> } => ({
  order: vi.fn(async () => order),
  open: vi.fn(async () => proof),
  verify: vi.fn(async () => free),
  slots: vi.fn(async () => full),
  ...over,
  wait: vi.fn(async () => {}),
});
const run = async (d: PayDeps) => {
  const seen: PayState[] = [];
  const last = await runPay(d, (s) => seen.push(s));
  return { seen, last };
};

describe("pay flow", () => {
  it("happy path goes opening, confirming, paid", async () => {
    const { seen, last } = await run(deps());
    expect(seen.map((s) => s.kind)).toEqual(["opening", "confirming", "paid"]);
    expect(last).toEqual(seen[seen.length - 1]);
    expect(last).toEqual({ kind: "paid", slots: free });
  });

  it("order refused with PAYMENTS_DISABLED stops and cannot pay again", async () => {
    const d = deps({ order: vi.fn(async () => { throw new AdapterError("PAYMENTS_DISABLED"); }) });
    const { last } = await run(d);
    expect(last).toEqual({ kind: "stopped", code: "PAYMENTS_DISABLED", reason: null, canPayAgain: false, proof: null });
    expect(d.open).not.toHaveBeenCalled();
  });

  it("order refused with POLICY_SLOT_AVAILABLE re-reads slots and reports paid", async () => {
    const d = deps({ order: vi.fn(async () => { throw new AdapterError("POLICY_SLOT_AVAILABLE"); }), slots: vi.fn(async () => free) });
    const { last } = await run(d);
    expect(d.slots).toHaveBeenCalledTimes(1);
    expect(last).toEqual({ kind: "paid", slots: free });
    expect(d.open).not.toHaveBeenCalled();
  });

  it("a closed window stops with PAYMENT_CANCELLED and can pay again", async () => {
    const { last } = await run(deps({ open: vi.fn(async () => { throw new AdapterError("PAYMENT_CANCELLED"); }) }));
    expect(last).toEqual({ kind: "stopped", code: "PAYMENT_CANCELLED", reason: null, canPayAgain: true, proof: null });
  });

  it("a failed payment keeps its reason and can pay again", async () => {
    const { last } = await run(deps({ open: vi.fn(async () => { throw new AdapterError("PAYMENT_FAILED", true, "insufficient_funds"); }) }));
    expect(last).toEqual({ kind: "stopped", code: "PAYMENT_FAILED", reason: "insufficient_funds", canPayAgain: true, proof: null });
    const unknown = await run(deps({ open: vi.fn(async () => { throw new AdapterError("PAYMENT_FAILED", true, "free provider text"); }) }));
    expect(unknown.last).toMatchObject({ reason: null, canPayAgain: true });
  });

  it("verify retries a retryable failure and then reports paid", async () => {
    const verify = vi.fn<PayDeps["verify"]>().mockRejectedValueOnce(new AdapterError("BACKEND_BUSY")).mockRejectedValueOnce(new AdapterError("X", true)).mockResolvedValue(free);
    const d = deps({ verify });
    const { last } = await run(d);
    expect(verify).toHaveBeenCalledTimes(3);
    expect(d.wait).toHaveBeenCalledWith(VERIFY_WAIT_MS);
    expect(last).toEqual({ kind: "paid", slots: free });
  });

  it("verify failing three times falls back to slots and reports paid when a slot is free", async () => {
    const verify = vi.fn(async (): Promise<PolicySlots> => { throw new AdapterError("BACKEND_TIMEOUT", true); });
    const slots = vi.fn<PayDeps["slots"]>().mockResolvedValueOnce(full).mockResolvedValueOnce(free);
    const d = deps({ verify, slots });
    const { last } = await run(d);
    expect(verify).toHaveBeenCalledTimes(VERIFY_TRIES);
    expect(slots).toHaveBeenCalledTimes(2);
    expect(d.wait).toHaveBeenCalledWith(SLOT_WAIT_MS);
    expect(last).toEqual({ kind: "paid", slots: free });
  });

  it("verify and slots both failing stops as PAYMENT_UNCONFIRMED, keeps the proof and cannot pay again", async () => {
    const d = deps({
      verify: vi.fn(async (): Promise<PolicySlots> => { throw new AdapterError("BACKEND_UNREACHABLE", true); }),
      slots: vi.fn(async (): Promise<PolicySlots> => { throw new AdapterError("BACKEND_UNREACHABLE", true); }),
    });
    const { last } = await run(d);
    expect(d.slots).toHaveBeenCalledTimes(SLOT_TRIES);
    expect(last).toEqual({ kind: "stopped", code: "PAYMENT_UNCONFIRMED", reason: null, canPayAgain: false, proof });
    const signedOut = deps({
      verify: vi.fn(async (): Promise<PolicySlots> => { throw new AdapterError("UNAUTHENTICATED"); }),
    });
    expect((await run(signedOut)).last).toEqual({ kind: "stopped", code: "UNAUTHENTICATED", reason: null, canPayAgain: false, proof });
  });

  it("a non-retryable verify refusal skips further verify tries and still re-reads slots", async () => {
    const verify = vi.fn(async (): Promise<PolicySlots> => { throw new AdapterError("PAYMENT_SIGNATURE_INVALID"); });
    const d = deps({ verify, slots: vi.fn(async () => full) });
    const { last } = await run(d);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(d.slots).toHaveBeenCalledTimes(SLOT_TRIES);
    expect(last).toMatchObject({ kind: "stopped", code: "PAYMENT_UNCONFIRMED", canPayAgain: false, proof });
  });

  it("confirmPay with a kept proof can reach paid without opening the window again", async () => {
    const d = deps();
    const seen: PayState[] = [];
    const last = await confirmPay(d, proof, (s) => seen.push(s));
    expect(d.verify).toHaveBeenCalledWith(proof);
    expect(d.order).not.toHaveBeenCalled();
    expect(d.open).not.toHaveBeenCalled();
    expect(seen.map((s) => s.kind)).toEqual(["confirming", "paid"]);
    expect(last).toEqual({ kind: "paid", slots: free });
  });

  it("no state after a proof exists has canPayAgain true", async () => {
    const failing = deps({
      verify: vi.fn(async (): Promise<PolicySlots> => { throw new AdapterError("BACKEND_BUSY"); }),
      slots: vi.fn(async () => full),
    });
    const seen: PayState[] = [];
    await runPay(failing, (s) => seen.push(s));
    const afterProof = seen.slice(seen.findIndex((s) => s.kind === "confirming"));
    expect(afterProof.length).toBeGreaterThan(0);
    for (const s of afterProof) expect(s.kind === "stopped" && s.canPayAgain).toBe(false);
  });

  it("payCopy returns the pinned text for every row", () => {
    const stopped = (code: string, reason: PayState extends infer S ? (S extends { kind: "stopped"; reason: infer R } ? R : never) : never = null): PayState =>
      ({ kind: "stopped", code, reason, canPayAgain: true, proof: null });
    const rows: [PayState, string][] = [
      [{ kind: "idle" }, ""],
      [{ kind: "opening" }, "Opening the payment window"],
      [{ kind: "confirming" }, "Confirming your payment"],
      [{ kind: "paid", slots: free }, "Paid. You can add your policy now."],
      [stopped("PAYMENT_CANCELLED"), "You closed the payment window. Nothing was paid."],
      [stopped("PAYMENT_FAILED", "declined"), "Your bank declined this payment. Try another card or UPI."],
      [stopped("PAYMENT_FAILED", "insufficient_funds"), "There was not enough balance. Try another card or UPI."],
      [stopped("PAYMENT_FAILED", "timed_out"), "The payment timed out. Try again."],
      [stopped("PAYMENT_FAILED", "authentication"), "Your bank could not verify you. Check the OTP or PIN and try again."],
      [stopped("PAYMENT_FAILED", "bank_unavailable"), "Your bank did not answer. Try again in a minute."],
      [stopped("PAYMENT_FAILED", "other"), "The payment did not go through. Try again."],
      [stopped("PAYMENT_FAILED", null), "The payment did not go through. Try again."],
      [stopped("PAYMENT_UNCONFIRMED"), "We are still confirming your payment. This can take a minute. Do not pay again."],
      [stopped("PAYMENTS_DISABLED"), "Adding another policy is not open yet."],
      [stopped("PAYMENTS_NOT_CONFIGURED"), "Adding another policy is not open yet."],
      [stopped("UNAUTHENTICATED"), "Please sign in again."],
      [stopped("SOMETHING_ELSE"), "We could not open the payment window. Try again."],
    ];
    for (const [state, text] of rows) expect(payCopy(state)).toBe(text);
  });

  it("runPay and confirmPay never throw", async () => {
    const boom = (): never => { throw new Error("raw provider text"); };
    const odd = deps({ order: vi.fn(async () => boom()), open: vi.fn(async () => boom()), verify: vi.fn(async () => boom()), slots: vi.fn(async () => boom()) });
    const first = await runPay(odd, () => {});
    expect(first).toMatchObject({ kind: "stopped", code: "BACKEND_UNREACHABLE", proof: null });
    const openOnly = deps({ open: vi.fn(async () => boom()) });
    expect(await runPay(openOnly, () => {})).toMatchObject({ kind: "stopped", code: "BACKEND_UNREACHABLE", canPayAgain: true });
    const confirm = await confirmPay(odd, proof, () => {});
    expect(confirm).toMatchObject({ kind: "stopped", code: "PAYMENT_UNCONFIRMED", canPayAgain: false, proof });
  });
});
