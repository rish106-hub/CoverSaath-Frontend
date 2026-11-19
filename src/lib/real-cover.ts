import type { FactView, HoldingSummary } from "@/adapters/covers-contract";

// Pure helpers for the real-account stress test. Figures come only from what the backend read from the person's own policy.
// A value that is missing or unreadable is null, never a guess.

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Money `{ amountMinor }` (paise) as rupees; null when it is not money. */
export function rupeesOfMoney(v: unknown): number | null {
  return isRecord(v) && Number.isSafeInteger(v.amountMinor) && (v.amountMinor as number) >= 0 ? (v.amountMinor as number) / 100 : null;
}

/** The sum insured of a holding in rupees; null when not found or in conflict. */
export function sumInsuredRs(s: HoldingSummary | null | undefined): number | null {
  const h = s?.sumInsured;
  return h && h.status !== "unknown" && h.status !== "conflicting" ? rupeesOfMoney(h.value) : null;
}

/** A co-pay percentage from a fact whose key says co-pay, in percent or basis points; null when absent, open or out of range. */
export function copayPct(facts: FactView[]): number | null {
  const f = facts.find((x) => /co_?pay/i.test(x.factKey) && x.status !== "unknown" && x.status !== "conflicting");
  if (!f) return null;
  const n = typeof f.value === "number" ? f.value : typeof f.value === "string" && /^\d+(\.\d+)?$/.test(f.value.trim()) ? Number(f.value) : null;
  if (n === null) return null;
  const pct = f.unit === "basis_points" ? n / 100 : n;
  return pct >= 0 && pct <= 100 ? pct : null;
}

export type StressLine = { title: string; value: number; kind: "bill" | "cut" | "pay" };
export type StressEstimate = { lines: StressLine[]; insurerPays: number; youPay: number; bill: number; copayApplied: number | null; limited: boolean };

/**
 * What the insurer and the person would each pay on one hospital bill, from the sum insured and the co-pay read from the policy.
 * An estimate only: non-payable items, room rent limits and sub-limits are not applied.
 */
export function estimate(billRs: number, siRs: number, copay: number | null): StressEstimate {
  const bill = Math.max(0, Math.round(billRs));
  const coAmt = copay ? Math.round((Math.min(bill, siRs) * copay) / 100) : 0;
  const insurerPays = Math.max(0, Math.min(bill - coAmt, siRs));
  const youPay = bill - insurerPays;
  const lines: StressLine[] = [{ title: "Hospital bill", value: bill, kind: "bill" }];
  if (copay) lines.push({ title: `Your co-pay, ${copay}%`, value: coAmt, kind: "cut" });
  lines.push({ title: "Above the sum insured", value: Math.max(0, bill - coAmt - siRs), kind: "cut" });
  lines.push({ title: "Insurer pays", value: insurerPays, kind: "pay" });
  return { lines, insurerPays, youPay, bill, copayApplied: copay, limited: bill - coAmt > siRs };
}
