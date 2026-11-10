import { afterEach, describe, expect, it, vi } from "vitest";
import { backendUploads, precheck } from "@/adapters/uploads";
import { AdapterError } from "@/adapters/types";
import { MAX_LARGE_UPLOAD_BYTES, MAX_UPLOAD_BYTES, QUARANTINE_AFTER_MS, deriveView } from "@/adapters/documents-contract";

const blobClient = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ upload: blobClient.upload }));

afterEach(() => {
  vi.unstubAllGlobals();
  blobClient.upload.mockReset();
});

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

const PREFIX = "uploads/0123456789abcdef01234567/";
const bigFile = (size = MAX_UPLOAD_BYTES + 1) => new File([new Uint8Array(size)], "big policy.pdf", { type: "application/pdf" });
const route = (table: Record<string, { status: number; body: unknown }>) => {
  const f = vi.fn(async (path: string, init?: RequestInit) => {
    const r = table[`${init?.method ?? "GET"} ${path}`] ?? { status: 404, body: { ok: false, code: "NOT_FOUND" } };
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  vi.stubGlobal("fetch", f);
  return f;
};

describe("large uploads", () => {
  it("precheck takes the limit as an argument", () => {
    const f = { name: "a.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 };
    expect(precheck(f, MAX_LARGE_UPLOAD_BYTES)).toBeNull();
    expect(precheck({ ...f, size: MAX_LARGE_UPLOAD_BYTES + 1 }, MAX_LARGE_UPLOAD_BYTES)).toBe("FILE_TOO_LARGE");
  });
  it("sends a file over 4 MB to Blob, then asks the server to take it", async () => {
    const f = route({
      "GET /api/app/documents/blob-token": { status: 200, body: { ok: true, prefix: PREFIX } },
      "POST /api/app/documents/from-blob": { status: 201, body: { ok: true, document: view } },
    });
    blobClient.upload.mockResolvedValue({ pathname: "x" });
    const file = bigFile();
    const doc = await backendUploads.upload(file, "policy_schedule", "key-12345678", "personal_health");
    expect(doc.id).toBe("d1");
    const [pathname, body, opts] = blobClient.upload.mock.calls[0];
    expect(pathname).toMatch(new RegExp(`^${PREFIX}k-[A-Za-z0-9_-]+\\.pdf$`));
    expect(body).toBe(file);
    expect(opts).toMatchObject({ access: "private", handleUploadUrl: "/api/app/documents/blob-token", contentType: "application/pdf", headers: { "x-knowvia-app": "1" } });
    const claim = f.mock.calls.find((c) => c[0] === "/api/app/documents/from-blob")!;
    expect(JSON.parse((claim[1] as RequestInit).body as string)).toEqual({ pathname, filename: "big policy.pdf", kind: "policy_schedule", policyType: "personal_health", key: "key-12345678" });
    expect((claim[1] as RequestInit).headers).toMatchObject({ "x-knowvia-app": "1" });
    expect(f.mock.calls.some((c) => c[0] === "/api/app/documents" && (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
  });
  it("uses a fresh blob name on every attempt, with the same key", async () => {
    route({
      "GET /api/app/documents/blob-token": { status: 200, body: { ok: true, prefix: PREFIX } },
      "POST /api/app/documents/from-blob": { status: 201, body: { ok: true, document: view } },
    });
    blobClient.upload.mockResolvedValue({});
    await backendUploads.upload(bigFile(), "policy_wording", "key-12345678", "personal_health");
    await backendUploads.upload(bigFile(), "policy_wording", "key-12345678", "personal_health");
    expect(blobClient.upload.mock.calls[0][0]).not.toBe(blobClient.upload.mock.calls[1][0]);
  });
  it("reports FILE_TOO_LARGE when the server has no Blob store", async () => {
    route({ "GET /api/app/documents/blob-token": { status: 503, body: { ok: false, code: "UPLOAD_UNAVAILABLE", retryable: false } } });
    await expect(backendUploads.upload(bigFile(), "policy_wording", "key-12345678", "personal_health")).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    expect(blobClient.upload).not.toHaveBeenCalled();
  });
  it("passes on a refusal such as no consent or the demo", async () => {
    route({ "GET /api/app/documents/blob-token": { status: 403, body: { ok: false, code: "CONSENT_REQUIRED", retryable: false } } });
    await expect(backendUploads.upload(bigFile(), "policy_wording", "key-12345678", "personal_health")).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    route({ "GET /api/app/documents/blob-token": { status: 403, body: { ok: false, code: "FORBIDDEN", retryable: false } } });
    await expect(backendUploads.upload(bigFile(), "policy_wording", "key-12345678", "personal_health")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(blobClient.upload).not.toHaveBeenCalled();
  });
  it("refuses over 15 MB and a wrong type without any call", async () => {
    const f = route({});
    await expect(backendUploads.upload(bigFile(MAX_LARGE_UPLOAD_BYTES + 1), "policy_wording", "key-12345678", "personal_health")).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    await expect(backendUploads.upload(new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "a.png", { type: "image/png" }), "policy_wording", "key-12345678", "personal_health")).rejects.toMatchObject({ code: "FILE_TYPE_INVALID" });
    expect(f).not.toHaveBeenCalled();
    expect(blobClient.upload).not.toHaveBeenCalled();
  });
  it("is retryable and skips the claim when the Blob upload fails", async () => {
    const f = route({ "GET /api/app/documents/blob-token": { status: 200, body: { ok: true, prefix: PREFIX } } });
    blobClient.upload.mockRejectedValue(new Error("network"));
    await expect(backendUploads.upload(bigFile(), "policy_wording", "key-12345678", "personal_health")).rejects.toMatchObject({ code: "BACKEND_UNREACHABLE", retryable: true });
    expect(f.mock.calls.some((c) => c[0] === "/api/app/documents/from-blob")).toBe(false);
  });
  it("passes on the server's answer when the claim fails", async () => {
    route({
      "GET /api/app/documents/blob-token": { status: 200, body: { ok: true, prefix: PREFIX } },
      "POST /api/app/documents/from-blob": { status: 404, body: { ok: false, code: "BLOB_MISSING", retryable: true } },
    });
    blobClient.upload.mockResolvedValue({});
    await expect(backendUploads.upload(bigFile(), "policy_wording", "key-12345678", "personal_health")).rejects.toMatchObject({ code: "BLOB_MISSING", retryable: true });
  });
  it("reports largeUpload from the list, false when absent", async () => {
    stub(200, { ok: true, consent: true, documents: [], largeUpload: true });
    expect((await backendUploads.list()).largeUpload).toBe(true);
    stub(200, { ok: true, consent: true, documents: [] });
    expect((await backendUploads.list()).largeUpload).toBe(false);
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
    await backendUploads.upload(file, "policy_schedule", "key-12345678", "personal_health");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/app/documents");
    expect(init?.headers).toMatchObject({ "x-knowvia-app": "1", "content-type": "application/pdf", "x-document-kind": "policy_schedule", "x-policy-type": "personal_health", "idempotency-key": "key-12345678", "x-filename": "my%20policy.pdf" });
    expect(init?.body).toBe(file);
  });
  it("refuses a wrong file without calling the server", async () => {
    const f = stub(200, {});
    await expect(backendUploads.upload(new File(["x"], "a.png", { type: "image/png" }), "policy_wording", "key-12345678", "personal_health")).rejects.toMatchObject({ code: "FILE_TYPE_INVALID" });
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
