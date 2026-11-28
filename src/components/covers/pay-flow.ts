// Pay sequence for a second policy, with no screen: order, payment window, verify, then a slot re-read as a fallback.
// It exists so a paid payment is never lost and the person is never invited to pay twice: once a proof exists, the flow can only
// confirm it, never open the payment window again. A screen renders the states and copy returned here.
import { AdapterError } from "@/adapters/types";
import { payments } from "@/adapters/payments";
import type { PaymentOrder, PaymentProof, PolicySlots } from "@/adapters/payments";
import { PAY_FAIL_REASONS, payWithRazorpay } from "@/lib/razorpay";
import type { PayFailReason } from "@/lib/razorpay";

export type PayDeps = {
  order(): Promise<PaymentOrder>;
  open(order: PaymentOrder): Promise<PaymentProof>;
  verify(proof: PaymentProof): Promise<PolicySlots>;
  slots(): Promise<PolicySlots>;
  /** Waits this many milliseconds. Tests pass a no-op. */
  wait(ms: number): Promise<void>;
};

export type PayState =
  | { kind: "idle" }
  | { kind: "opening" }
  | { kind: "confirming" }
  | { kind: "paid"; slots: PolicySlots }
  | { kind: "stopped"; code: string; reason: PayFailReason | null; canPayAgain: boolean; proof: PaymentProof | null };

export const VERIFY_TRIES = 3;
export const VERIFY_WAIT_MS = 2000;
export const SLOT_TRIES = 3;
export const SLOT_WAIT_MS = 3000;

const NO_PAY_AGAIN_CODES = ["PAYMENTS_DISABLED", "PAYMENTS_NOT_CONFIGURED", "UNAUTHENTICATED"];
const TRANSIENT_CODES = ["BACKEND_UNREACHABLE", "BACKEND_TIMEOUT", "BACKEND_BUSY"];

export function realPayDeps(): PayDeps {
  return {
    order: payments.order,
    open: (o) => payWithRazorpay(o),
    verify: payments.verify,
    slots: payments.slots,
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

const codeOf = (e: unknown): string => (e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE");

function reasonOfError(e: unknown): PayFailReason | null {
  const reason = e instanceof AdapterError ? e.reason : null;
  return PAY_FAIL_REASONS.find((known) => known === reason) ?? null;
}

// The state is reported and returned together so the caller's last onState call always equals the return value.
function finish(onState: (s: PayState) => void, state: PayState): PayState {
  onState(state);
  return state;
}

export async function runPay(deps: PayDeps, onState: (s: PayState) => void): Promise<PayState> {
  onState({ kind: "opening" });
  let order: PaymentOrder;
  try {
    order = await deps.order();
  } catch (e) {
    const code = codeOf(e);
    if (code === "POLICY_SLOT_AVAILABLE") {
      // The backend says a slot is already free: a payment went through earlier, so confirm it instead of charging again.
      try {
        const slots = await deps.slots();
        if (slots.canAdd === true) return finish(onState, { kind: "paid", slots });
      } catch {
        // falls through to the stopped state below
      }
      return finish(onState, { kind: "stopped", code, reason: null, canPayAgain: true, proof: null });
    }
    return finish(onState, { kind: "stopped", code, reason: null, canPayAgain: !NO_PAY_AGAIN_CODES.includes(code), proof: null });
  }
  let proof: PaymentProof;
  try {
    proof = await deps.open(order);
  } catch (e) {
    return finish(onState, { kind: "stopped", code: codeOf(e), reason: reasonOfError(e), canPayAgain: true, proof: null });
  }
  return confirmPay(deps, proof, onState);
}

export async function confirmPay(deps: PayDeps, proof: PaymentProof, onState: (s: PayState) => void): Promise<PayState> {
  onState({ kind: "confirming" });
  let lastCode = "BACKEND_UNREACHABLE";
  try {
    for (let attempt = 1; attempt <= VERIFY_TRIES; attempt++) {
      try {
        const slots = await deps.verify(proof);
        return finish(onState, { kind: "paid", slots });
      } catch (e) {
        lastCode = codeOf(e);
        const transient = (e instanceof AdapterError && e.retryable === true) || TRANSIENT_CODES.includes(lastCode);
        if (!transient) break;
        if (attempt < VERIFY_TRIES) await deps.wait(VERIFY_WAIT_MS);
      }
    }
    for (let attempt = 1; attempt <= SLOT_TRIES; attempt++) {
      if (attempt > 1) await deps.wait(SLOT_WAIT_MS);
      try {
        const slots = await deps.slots();
        if (slots.canAdd === true) return finish(onState, { kind: "paid", slots });
      } catch {
        // a failed read counts as a try
      }
    }
  } catch {
    // a failing wait must not turn into a throw; the proof is kept below
  }
  // canPayAgain stays false and the proof is kept: the payment may have been taken, so "Check again" re-confirms it.
  const code = lastCode === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "PAYMENT_UNCONFIRMED";
  return finish(onState, { kind: "stopped", code, reason: null, canPayAgain: false, proof });
}

// FOR LEGAL REVIEW: price and payment wording.
const FAILED_COPY: Record<PayFailReason, string> = {
  declined: "Your bank declined this payment. Try another card or UPI.",
  insufficient_funds: "There was not enough balance. Try another card or UPI.",
  timed_out: "The payment timed out. Try again.",
  authentication: "Your bank could not verify you. Check the OTP or PIN and try again.",
  bank_unavailable: "Your bank did not answer. Try again in a minute.",
  other: "The payment did not go through. Try again.",
};

export function payCopy(state: PayState): string {
  switch (state.kind) {
    case "idle":
      return "";
    case "opening":
      return "Opening the payment window";
    case "confirming":
      return "Confirming your payment";
    case "paid":
      return "Paid. You can add your policy now.";
    case "stopped":
      switch (state.code) {
        case "PAYMENT_CANCELLED":
          return "You closed the payment window. Nothing was paid.";
        case "PAYMENT_FAILED":
          return FAILED_COPY[state.reason ?? "other"];
        case "PAYMENT_UNCONFIRMED":
          return "We are still confirming your payment. This can take a minute. Do not pay again.";
        case "PAYMENTS_DISABLED":
        case "PAYMENTS_NOT_CONFIGURED":
          return "Adding another policy is not open yet.";
        case "UNAUTHENTICATED":
          return "Please sign in again.";
        default:
          return "We could not open the payment window. Try again.";
      }
  }
}
