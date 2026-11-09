import { afterEach, describe, expect, it, vi } from "vitest";
import { backendUploads, precheck } from "@/adapters/uploads";
import { AdapterError } from "@/adapters/types";
import { MAX_UPLOAD_BYTES, QUARANTINE_AFTER_MS, deriveView } from "@/adapters/documents-contract";

afterEach(() => vi.unstubAllGlobals());

const view = {
  id: "d1", kind: "policy_wording", sizeBytes: 10, uploadedAt: null,
  steps: { uploaded: "done", scanned: "done", reading: "active", structured: "pending" }, note: null, busy: true,
};
const stub = (status: number, body: unknown) => {
  const f = vi.fn(async (_path: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", f);
  return f;
};

describe("precheck", () => {
  it("accepts a PDF and rejects other types, empty and oversize files", () => {
    expect(precheck({ name: "a.pdf", type: "application/pdf", size: 10 })).toBeNull();
    expect(precheck({ name: "a.pdf", type: "", size: 10 })).toBeNull();
    expect(precheck({ name: "a.png", type: "image/png", size: 10 })).toBe("FILE_TYPE_INVALID");
    expect(precheck({ name: "a.pdf", type: "application/pdf", size: 0 })).toBe("FILE_EMPTY");
    expect(precheck({ name: "a.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 })).toBe("FILE_TOO_LARGE");
  });
});

describe("backendUploads", () => {
  it("parses a list", async () => {
    stub(200, { ok: true, consent: true, documents: [view] });
    expect((await backendUploads.list()).documents[0].id).toBe("d1");
  });
  it("sends the file raw with the app header, key, kind and name", async () => {
    const f = stub(201, { ok: true, document: view });
    const file = new File([new Uint8Array([37, 80, 68, 70, 45])], "my policy.pdf", { type: "application/pdf" });
    await backendUploads.upload(file, "policy_schedule", "key-12345678");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/app/documents");
    expect(init?.headers).toMatchObject({ "x-knowvia-app": "1", "content-type": "application/pdf", "x-document-kind": "policy_schedule", "idempotency-key": "key-12345678", "x-filename": "my%20policy.pdf" });
    expect(init?.body).toBe(file);
  });
  it("refuses a wrong file without calling the server", async () => {
    const f = stub(200, {});
    await expect(backendUploads.upload(new File(["x"], "a.png", { type: "image/png" }), "policy_wording", "key-12345678")).rejects.toMatchObject({ code: "FILE_TYPE_INVALID" });
    expect(f).not.toHaveBeenCalled();
  });
  it("turns a coded failure into an AdapterError with the retry flag", async () => {
    stub(403, { ok: false, code: "CONSENT_REQUIRED", retryable: false });
    await expect(backendUploads.advance("d1")).rejects.toMatchObject({ code: "CONSENT_REQUIRED", retryable: false });
    stub(503, { ok: false, code: "BACKEND_BUSY", retryable: true });
    const e = await backendUploads.list().catch((x) => x);
    expect(e).toBeInstanceOf(AdapterError);
    expect(e).toMatchObject({ code: "BACKEND_BUSY", retryable: true });
  });
  it("reports an unreachable app as retryable and a malformed answer as bad response", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("offline"); });
    await expect(backendUploads.list()).rejects.toMatchObject({ code: "BACKEND_UNREACHABLE", retryable: true });
    stub(200, { ok: true, nope: 1 });
    await expect(backendUploads.list()).rejects.toMatchObject({ code: "BACKEND_BAD_RESPONSE" });
  });
  it("sends retry and delete to the right places", async () => {
    const f = stub(200, { ok: true, document: view });
    await backendUploads.advance("d 1", true);
    expect(f.mock.calls[0][0]).toBe("/api/app/documents/d%201/advance");
    expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)).toEqual({ retry: true });
    stub(200, { ok: true });
    await expect(backendUploads.remove("d1")).resolves.toBeUndefined();
  });
});

describe("deriveView", () => {
  const doc = (status: string, uploadedAt: string | null = new Date().toISOString()) => ({ id: "d", documentKind: "policy_wording", byteSize: 1, status, uploadedAt });
  it("walks the four steps", () => {
    expect(deriveView(doc("received_pending_checks"), "none", "none").steps.scanned).toBe("active");
    expect(deriveView(doc("accepted"), "none", "none").steps).toMatchObject({ scanned: "done", reading: "active" });
    expect(deriveView(doc("accepted"), "done", "running").steps).toMatchObject({ reading: "done", structured: "active" });
    const done = deriveView(doc("accepted"), "done", "done");
    expect(done.steps.structured).toBe("done");
    expect(done.busy).toBe(false);
  });
  it("marks rejected, quarantined, failed and deleting", () => {
    expect(deriveView(doc("rejected"), "none", "none")).toMatchObject({ note: "REJECTED", busy: false, steps: { scanned: "failed" } });
    const old = new Date(Date.now() - QUARANTINE_AFTER_MS - 1000).toISOString();
    expect(deriveView(doc("received_pending_checks", old), "none", "none")).toMatchObject({ note: "QUARANTINED", busy: true });
    expect(deriveView(doc("accepted"), "failed", "none").note).toBe("READING_FAILED");
    expect(deriveView(doc("accepted"), "unavailable", "none").note).toBe("READING_UNAVAILABLE");
    expect(deriveView(doc("accepted"), "done", "failed").note).toBe("STRUCTURING_FAILED");
    expect(deriveView(doc("deletion_pending"), "done", "done").note).toBe("DELETING");
  });
});
