import type { Receipt, ReconcileResult } from "@/adapters/schemas";

/** Receipt matching (BUILD-SPEC 6, Money). Pure and deterministic: amount within Rs 1, a date window, optional policy number. */

export type ReceiptLike = { id: string; amountRs: number; date: string; policyNumber?: string; key?: string };
export type ExpectedPayment = { id: string; amountRs: number; dueDate: string; policyNumber?: string };
export type ReconcileOptions = { toleranceRs?: number; windowDays?: number };

const DAY = 86_400_000;
export const DEFAULT_TOLERANCE_RS = 1;
export const DEFAULT_WINDOW_DAYS = 14;

function days(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
}
function samePolicy(a?: string, b?: string): boolean {
  return !a || !b || a.trim().toLowerCase() === b.trim().toLowerCase();
}
function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

export type DuplicatePair = { receiptId: string; ofReceiptId: string; amountRs: number };

export type ReconcileReport = {
  matches: { expectedId: string; receiptId: string }[];
  duplicates: DuplicatePair[];
  unmatchedExpected: string[];
  unmatchedReceipts: string[];
  refundRs: number;
};

/** Match each expected payment to the earliest receipt with the same amount (±Rs 1), policy and a date inside the window. Later look-alikes are duplicates. */
export function reconcileReceipts(receipts: ReceiptLike[], expected: ExpectedPayment[], opts: ReconcileOptions = {}): ReconcileReport {
  const tol = opts.toleranceRs ?? DEFAULT_TOLERANCE_RS;
  const win = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const sorted = [...receipts].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const used = new Set<string>();
  const matches: ReconcileReport["matches"] = [];
  const unmatchedExpected: string[] = [];

  for (const e of expected) {
    const hit = sorted.find((r) => !used.has(r.id) && near(r.amountRs, e.amountRs, tol) && samePolicy(r.policyNumber, e.policyNumber) && days(r.date, e.dueDate) <= win);
    if (hit) {
      used.add(hit.id);
      matches.push({ expectedId: e.id, receiptId: hit.id });
    } else unmatchedExpected.push(e.id);
  }

  const matched = sorted.filter((r) => used.has(r.id));
  const duplicates: DuplicatePair[] = [];
  const unmatchedReceipts: string[] = [];
  for (const r of sorted) {
    if (used.has(r.id)) continue;
    const twin = matched.find((m) => near(m.amountRs, r.amountRs, tol) && samePolicy(m.policyNumber, r.policyNumber) && days(m.date, r.date) <= win);
    if (twin) duplicates.push({ receiptId: r.id, ofReceiptId: twin.id, amountRs: r.amountRs });
    else unmatchedReceipts.push(r.id);
  }
  return { matches, duplicates, unmatchedExpected, unmatchedReceipts, refundRs: duplicates.reduce((s, d) => s + d.amountRs, 0) };
}

/** Duplicate payments with no expected list: same key (person and item), amount ±Rs 1, within the window. The earlier one stays; the later one is the duplicate. */
export function findDuplicates(items: ReceiptLike[], opts: ReconcileOptions = {}): DuplicatePair[] {
  const tol = opts.toleranceRs ?? DEFAULT_TOLERANCE_RS;
  const win = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const sorted = [...items].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const kept: ReceiptLike[] = [];
  const out: DuplicatePair[] = [];
  for (const r of sorted) {
    const twin = kept.find((k) => k.key === r.key && near(k.amountRs, r.amountRs, tol) && samePolicy(k.policyNumber, r.policyNumber) && days(k.date, r.date) <= win);
    if (twin) out.push({ receiptId: r.id, ofReceiptId: twin.id, amountRs: r.amountRs });
    else kept.push(r);
  }
  return out;
}

/** Summary used by ReconcileAdapter (mock). */
export function summariseReceipts(receipts: Receipt[], opts?: ReconcileOptions): ReconcileResult {
  const dups = findDuplicates(
    receipts.map((r) => ({ id: r.id, amountRs: r.amountRs, date: r.date, key: `${r.memberId}:${r.label.replace(/ \(.*\)$/, "")}` })),
    opts,
  );
  return { matched: receipts.length - dups.length, duplicates: dups.length, refundRs: dups.reduce((s, d) => s + d.amountRs, 0) };
}
