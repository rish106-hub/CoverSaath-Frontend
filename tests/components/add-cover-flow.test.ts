import { describe, expect, it, vi } from "vitest";
import { AdapterError } from "@/adapters/types";
import { canRetry, checkSchedule, emptySlot, pickFile, runSchedule, runTerms } from "@/components/covers/add-cover-flow";

const pdf = (name: string) => new File([new Uint8Array(8)], name, { type: "application/pdf" });
const deps = () => ({
  uploadDocument: vi.fn(async (_f: File, _k: string, kind: string) => ({ documentId: kind === "policy_schedule" ? "doc-s" : "doc-t" })),
  holdingFor: vi.fn(async (): Promise<string | null> => "holding-1"),
  linkDocument: vi.fn(async (holdingId: string, i: { documentId: string }) => ({ holdingId, documentId: i.documentId, kind: "wording", linked: true })),
});

describe("add cover flow", () => {
  it("uploads the schedule as policy_schedule with the chosen type and returns the holding", async () => {
    const d = deps();
    const slot = pickFile(pdf("schedule.pdf"));
    const r = await runSchedule(d, slot, "group_health");
    expect(d.uploadDocument).toHaveBeenCalledWith(slot.file, slot.key, "policy_schedule", "group_health");
    expect(r.holdingId).toBe("holding-1");
    expect(r.slot).toMatchObject({ status: "done", documentId: "doc-s" });
  });
  it("waits when the backend has not made the holding yet, then finds it without uploading again", async () => {
    const d = deps();
    d.holdingFor.mockResolvedValueOnce(null);
    const first = await runSchedule(d, pickFile(pdf("s.pdf")), "personal_health");
    expect(first).toMatchObject({ holdingId: null, slot: { status: "waiting", documentId: "doc-s" } });
    const second = await checkSchedule(d, first.slot);
    expect(second).toMatchObject({ holdingId: "holding-1", slot: { status: "done" } });
    expect(d.uploadDocument).toHaveBeenCalledTimes(1);
  });
  it("a failed schedule upload is a failed slot that keeps its key and file for the retry", async () => {
    const d = deps();
    d.uploadDocument.mockRejectedValueOnce(new AdapterError("BACKEND_UNREACHABLE", true));
    const slot = pickFile(pdf("s.pdf"));
    const r = await runSchedule(d, slot, "personal_health");
    expect(r.slot).toMatchObject({ status: "failed", code: "BACKEND_UNREACHABLE", key: slot.key, documentId: null });
    expect(canRetry(r.slot)).toBe(true);
    const again = await runSchedule(d, r.slot, "personal_health");
    expect(again.slot.status).toBe("done");
    expect(d.uploadDocument.mock.calls[1]![1]).toBe(slot.key);
  });
  it("uploads the terms as policy_wording and links them to the holding", async () => {
    const d = deps();
    const slot = await runTerms(d, pickFile(pdf("t.pdf")), "personal_health", "holding-1");
    expect(d.uploadDocument.mock.calls[0]![2]).toBe("policy_wording");
    expect(d.linkDocument).toHaveBeenCalledWith("holding-1", { documentId: "doc-t", kind: "wording" });
    expect(slot.status).toBe("done");
  });
  it("a failed link retries only the link: the file is not uploaded twice", async () => {
    const d = deps();
    d.linkDocument.mockRejectedValueOnce(new AdapterError("BACKEND_UNREACHABLE", true));
    const failed = await runTerms(d, pickFile(pdf("t.pdf")), "personal_health", "holding-1");
    expect(failed).toMatchObject({ status: "failed", documentId: "doc-t" });
    const ok = await runTerms(d, failed, "personal_health", "holding-1");
    expect(ok.status).toBe("done");
    expect(d.uploadDocument).toHaveBeenCalledTimes(1);
    expect(d.linkDocument).toHaveBeenCalledTimes(2);
  });
  it("does not offer a retry for a file the backend refused for good", async () => {
    const d = deps();
    d.uploadDocument.mockRejectedValueOnce(new AdapterError("PDF_PROTECTED"));
    const r = await runTerms(d, pickFile(pdf("t.pdf")), "personal_health", "holding-1");
    expect(r.code).toBe("PDF_PROTECTED");
    expect(canRetry(r)).toBe(false);
  });
  it("does nothing for an empty slot", async () => {
    const d = deps();
    expect(await runTerms(d, emptySlot(), "personal_health", "holding-1")).toMatchObject({ status: "empty" });
    expect(d.uploadDocument).not.toHaveBeenCalled();
  });
});
