import type { CoversAdapter } from "@/adapters/types";
import type { PolicyType } from "@/adapters/documents-contract";
import { AdapterError } from "@/adapters/types";
import { makeRequestKey } from "@/adapters/uploads";

// The add-cover sequence, with no screen in it: the policy schedule goes up first and the backend makes the holding from it; the
// terms and conditions go up second and are linked to that holding. Each slot keeps what it already did (the document id), so a
// retry repeats only the step that failed: a failed link never uploads the file twice. Nothing here throws; a failure is in the slot.

export type SlotStatus = "empty" | "working" | "waiting" | "failed" | "done";
export type Slot = {
  status: SlotStatus;
  file: File | null;
  /** Reused on every retry of the upload, so a retry cannot store the file twice. */
  key: string;
  documentId: string | null;
  code: string | null;
};
export const emptySlot = (): Slot => ({ status: "empty", file: null, key: makeRequestKey(), documentId: null, code: null });
export const pickFile = (file: File): Slot => ({ ...emptySlot(), status: "working", file });

type Deps = Pick<CoversAdapter, "uploadDocument" | "holdingFor" | "linkDocument">;
const codeOf = (e: unknown): string => (e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE");
/** Refusals a second try with the same file cannot fix. */
const FINAL = new Set(["FILE_TYPE_INVALID", "FILE_TOO_LARGE", "FILE_EMPTY", "PDF_PROTECTED", "PDF_UNREADABLE", "PDF_ACTIVE_CONTENT", "PDF_TOO_LONG", "PDF_TOO_COMPLEX", "DUPLICATE_DOCUMENT", "POLICY_TYPE_INVALID", "HOLDING_CREATE_FAILED"]);
export const canRetry = (slot: Slot): boolean => slot.status === "failed" && !(slot.code && FINAL.has(slot.code));

const fail = (slot: Slot, e: unknown): Slot => ({ ...slot, status: "failed", code: codeOf(e) });

/** Schedule: upload, then find the holding the backend made from it. `holdingId` is null while the backend has not made it yet. */
export async function runSchedule(deps: Deps, slot: Slot, policyType: PolicyType): Promise<{ slot: Slot; holdingId: string | null }> {
  if (!slot.file) return { slot, holdingId: null };
  let cur: Slot = { ...slot, status: "working", code: null };
  try {
    if (!cur.documentId) cur = { ...cur, documentId: (await deps.uploadDocument(cur.file!, cur.key, "policy_schedule", policyType)).documentId };
    const holdingId = await deps.holdingFor(cur.documentId!);
    return holdingId ? { slot: { ...cur, status: "done" }, holdingId } : { slot: { ...cur, status: "waiting" }, holdingId: null };
  } catch (e) {
    return { slot: fail(cur, e), holdingId: null };
  }
}

/** One more look for the holding after the schedule is in. */
export async function checkSchedule(deps: Deps, slot: Slot): Promise<{ slot: Slot; holdingId: string | null }> {
  if (!slot.documentId) return { slot, holdingId: null };
  try {
    const holdingId = await deps.holdingFor(slot.documentId);
    return holdingId ? { slot: { ...slot, status: "done", code: null }, holdingId } : { slot, holdingId: null };
  } catch (e) {
    return { slot: fail(slot, e), holdingId: null };
  }
}

/** Terms and conditions: upload (skipped when it already went up), then link to the schedule's holding. */
export async function runTerms(deps: Deps, slot: Slot, policyType: PolicyType, holdingId: string): Promise<Slot> {
  if (!slot.file) return slot;
  let cur: Slot = { ...slot, status: "working", code: null };
  try {
    if (!cur.documentId) cur = { ...cur, documentId: (await deps.uploadDocument(cur.file!, cur.key, "policy_wording", policyType)).documentId };
    await deps.linkDocument(holdingId, { documentId: cur.documentId!, kind: "wording" });
    return { ...cur, status: "done" };
  } catch (e) {
    return fail(cur, e);
  }
}
