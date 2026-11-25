import { afterEach, describe, expect, it, vi } from "vitest";
import { backendCovers, stopCode } from "@/adapters/covers";
import { backendUploads } from "@/adapters/uploads";
import { AdapterError } from "@/adapters/types";
import { holdingDocumentsIn, sourceView, WORDING_REASONS } from "@/adapters/covers-contract";
import { errorText, type DocView } from "@/adapters/documents-contract";
import { pageText, sideLabel } from "@/components/covers/format";
import type { UploadStage } from "@/adapters/types";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const pdf = () => new File([new Uint8Array(64)], "policy.pdf", { type: "application/pdf" });
const doc = (steps: Partial<DocView["steps"]>, extra: Partial<DocView> = {}): DocView => ({
  id: "d1", kind: "policy_schedule", sizeBytes: 64, uploadedAt: null, note: null, busy: false,
  steps: { uploaded: "done", scanned: "done", reading: "done", structured: "done", ...steps }, ...extra,
});

describe("upload follow-up", () => {
  it("a refused file is an error, not a success that waits for a holding", async () => {
    vi.spyOn(backendUploads, "upload").mockResolvedValue(doc({ scanned: "failed" }, { note: "REJECTED" }));
    await expect(backendCovers.uploadDocument(pdf(), "k", "policy_schedule", "personal_health")).rejects.toMatchObject({ code: "DOCUMENT_REJECTED" });
    expect(errorText("DOCUMENT_REJECTED")).toMatch(/could not be accepted/);
  });
  it("a failed or unavailable reading is an error the person is told about", () => {
    expect(stopCode(doc({ reading: "failed" }, { note: "READING_FAILED" }))).toBe("READING_FAILED");
    expect(stopCode(doc({ reading: "unavailable" }, { note: "READING_UNAVAILABLE" }))).toBe("READING_UNAVAILABLE");
    expect(errorText("READING_FAILED")).toMatch(/could not read/);
  });
  it("a failed cover-details step does not stop the upload: the holding comes from the reading", async () => {
    vi.spyOn(backendUploads, "upload").mockResolvedValue(doc({ structured: "failed" }, { note: "STRUCTURING_FAILED" }));
    expect(stopCode(doc({ structured: "failed" }, { note: "STRUCTURING_FAILED" }))).toBeNull();
    await expect(backendCovers.uploadDocument(pdf(), "k", "policy_schedule", "personal_health")).resolves.toEqual({ documentId: "d1", busy: false });
  });
  it("follows the real steps in order and keeps going well past 16 s", async () => {
    vi.useFakeTimers();
    vi.spyOn(backendUploads, "upload").mockResolvedValue(doc({ scanned: "active" }, { busy: true }));
    let calls = 0;
    vi.spyOn(backendUploads, "advance").mockImplementation(async () => {
      calls += 1;
      if (calls < 12) return doc({ reading: "active" }, { busy: true });
      return doc({ structured: "active" }, calls < 14 ? { busy: true } : { busy: false });
    });
    const stages: UploadStage[] = [];
    const p = backendCovers.uploadDocument(pdf(), "k", "policy_schedule", "personal_health", (s) => stages.push(s));
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ documentId: "d1", busy: false });
    expect(calls).toBeGreaterThan(8);
    expect(stages[0]).toBe("sending");
    expect(stages).toContain("checking");
    expect(stages).toContain("reading");
    expect(stages.at(-1)).toBe("details");
  });
  it("still busy after the wait: returns busy so the page says it is still reading", async () => {
    vi.useFakeTimers();
    vi.spyOn(backendUploads, "upload").mockResolvedValue(doc({ reading: "active" }, { busy: true }));
    vi.spyOn(backendUploads, "advance").mockResolvedValue(doc({ reading: "active" }, { busy: true }));
    const p = backendCovers.uploadDocument(pdf(), "k", "policy_schedule", "personal_health");
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ documentId: "d1", busy: true });
  });
  it("the same file again after a failed reading restarts the reading once", async () => {
    vi.spyOn(backendUploads, "upload").mockResolvedValue(doc({ reading: "failed" }, { note: "READING_FAILED" }));
    const adv = vi.spyOn(backendUploads, "advance").mockResolvedValue(doc({}, { busy: false }));
    await backendCovers.uploadDocument(pdf(), "k", "policy_schedule", "personal_health");
    expect(adv).toHaveBeenCalledWith("d1", true);
  });
  it("resumeDocument moves the document on without sending the file", async () => {
    const up = vi.spyOn(backendUploads, "upload");
    vi.spyOn(backendUploads, "advance").mockResolvedValue(doc({}, { busy: false }));
    await expect(backendCovers.resumeDocument("d1")).resolves.toEqual({ documentId: "d1", busy: false });
    expect(up).not.toHaveBeenCalled();
  });
});

describe("page numbers and wording from the backend", () => {
  it("cites the backend page number, never the digits of a block id", () => {
    const src = sourceView.parse({ id: "s", page: { pageId: "chunk-75", blockIndex: 3, pageNumber: 4 } });
    expect(pageText(src.page)).toBe("Page 4");
    expect(sideLabel(src)).toContain("page 4");
    expect(sideLabel(src)).not.toContain("75");
  });
  it("no page number means no page claim", () => {
    const src = sourceView.parse({ id: "s", page: { pageId: "chunk-75" } });
    expect(pageText(src.page)).toBe("In the document");
    expect(sideLabel(src)).not.toMatch(/page \d/);
  });
  it("wording reasons: not_checked is known, attached is not sent by the backend", () => {
    expect(WORDING_REASONS).toContain("not_checked");
    expect(WORDING_REASONS).toContain("pending");
    expect(WORDING_REASONS).not.toContain("attached");
  });
  it("reads the per-document factsState and tolerates an older or newer backend", () => {
    const r = holdingDocumentsIn.parse({ holdingId: "h", documents: [{ documentId: "a", kind: "wording", factsState: "off" }, { documentId: "b", kind: "x" }, { documentId: "c", kind: "x", factsState: "new_value" }] });
    expect(r.documents.map((d) => d.factsState ?? null)).toEqual(["off", null, null]);
  });
  it("one timed-out step does not end the follow-up: it asks again", async () => {
    vi.useFakeTimers();
    vi.spyOn(backendUploads, "upload").mockResolvedValue(doc({ reading: "active" }, { busy: true }));
    let calls = 0;
    vi.spyOn(backendUploads, "advance").mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new AdapterError("BACKEND_UNREACHABLE", true);
      return doc({}, { busy: false });
    });
    const p = backendCovers.uploadDocument(pdf(), "k", "policy_schedule", "personal_health");
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ documentId: "d1", busy: false });
    expect(calls).toBe(2);
  });
  it("three timed-out steps in a row are a real stop", async () => {
    vi.useFakeTimers();
    vi.spyOn(backendUploads, "upload").mockResolvedValue(doc({ reading: "active" }, { busy: true }));
    const adv = vi.spyOn(backendUploads, "advance").mockRejectedValue(new AdapterError("BACKEND_UNREACHABLE", true));
    const p = backendCovers.uploadDocument(pdf(), "k", "policy_schedule", "personal_health");
    const seen = p.then(() => null, (e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(await seen).toMatchObject({ code: "BACKEND_UNREACHABLE" });
    expect(adv).toHaveBeenCalledTimes(3);
  });
  it("a refusal (not retryable) stops at once", async () => {
    vi.useFakeTimers();
    vi.spyOn(backendUploads, "upload").mockResolvedValue(doc({ reading: "active" }, { busy: true }));
    const adv = vi.spyOn(backendUploads, "advance").mockRejectedValue(new AdapterError("CONSENT_REQUIRED"));
    const p = backendCovers.uploadDocument(pdf(), "k", "policy_schedule", "personal_health");
    const seen = p.then(() => null, (e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(await seen).toMatchObject({ code: "CONSENT_REQUIRED" });
    expect(adv).toHaveBeenCalledTimes(1);
  });
});
