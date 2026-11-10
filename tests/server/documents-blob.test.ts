import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/server/backend/session";

const SECRET = "s".repeat(40);
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => ({ host: "localhost:3200" })[n.toLowerCase()] ?? null }),
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
}));

type Opts = { allowedContentTypes?: string[]; maximumSizeInBytes?: number; validUntil?: number; allowOverwrite?: boolean };
const blob = vi.hoisted(() => ({
  get: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
  handleUpload: vi.fn(),
}));
vi.mock("@vercel/blob", () => ({ get: blob.get, del: blob.del, list: blob.list }));
vi.mock("@vercel/blob/client", () => ({ handleUpload: blob.handleUpload }));

import * as tokenRoute from "@/app/api/app/documents/blob-token/route";
import * as fromBlob from "@/app/api/app/documents/from-blob/route";
import * as docs from "@/app/api/app/documents/route";
import * as consent from "@/app/api/app/documents/consent/route";
import { blobPrefix } from "@/server/backend/documents";
import { MAX_LARGE_UPLOAD_BYTES, MAX_UPLOAD_BYTES } from "@/adapters/documents-contract";

const DOC = { id: "doc-1", documentKind: "policy_wording", byteSize: 64, status: "accepted", uploadedAt: new Date().toISOString() };
let backendCalls: { path: string; method: string; body: unknown }[];
const PREFIX = blobPrefix({ t: "tok", h: "h1", m: "m1", exp: 0 });
const NAME = `${PREFIX}abcdefgh12345678.pdf`;

const pdf = (n = 64) => {
  const b = new Uint8Array(n);
  b.set(new TextEncoder().encode("%PDF-1.7\n"));
  return b;
};
const streamOf = (b: Uint8Array, chunk = 1024) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < b.length; i += chunk) c.enqueue(b.subarray(i, i + chunk));
      c.close();
    },
  });
const found = (bytes: Uint8Array, over: { contentType?: string; size?: number } = {}) => ({
  statusCode: 200,
  stream: streamOf(bytes),
  headers: new Headers(),
  blob: { contentType: over.contentType ?? "application/pdf", size: over.size ?? bytes.byteLength },
});

const req = (path: string, method = "GET", o: { body?: BodyInit; headers?: Record<string, string> } = {}) =>
  new Request(`http://app.test${path}`, { method, headers: { host: "app.test", "x-knowvia-app": "1", ...o.headers }, body: o.body });
const post = (route: { POST: (r: Request) => Promise<Response> }, path: string, body: unknown, headers: Record<string, string> = {}) =>
  route.POST(req(path, "POST", { body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } }));
const claim = (over: Record<string, unknown> = {}) =>
  post(fromBlob, "/api/app/documents/from-blob", { pathname: NAME, filename: "big policy.pdf", kind: "policy_wording", key: "key-12345678", ...over });
const tokenReq = (over: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  post(tokenRoute, "/api/app/documents/blob-token", { type: "blob.generate-client-token", payload: { pathname: NAME, clientPayload: null, multipart: false }, ...over }, headers);

const signIn = (extra: Record<string, unknown> = {}) => jar.set("kv_session", seal({ t: "tok-secret", h: "h1", m: "m1", a: "adult1", exp: Date.now() + 60_000, ...extra }, SECRET));
const grant = () => post(consent, "/api/app/documents/consent", { accept: true, requestId: "req-12345678" });

beforeEach(async () => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_token";
  jar.clear();
  backendCalls = [];
  blob.get.mockReset();
  blob.del.mockReset().mockResolvedValue(undefined);
  blob.list.mockReset().mockResolvedValue({ blobs: [] });
  blob.handleUpload.mockReset().mockImplementation(async ({ body, onBeforeGenerateToken }) => {
    const opts: Opts = await onBeforeGenerateToken(body.payload.pathname, null, false);
    return { type: "blob.generate-client-token", clientToken: "client-token", opts };
  });
  const routes: Record<string, { status: number; body: unknown }> = {
    "POST /api/v1/cases": { status: 201, body: { id: "case-1" } },
    "POST /api/v1/consents": { status: 201, body: { id: "consent-1" } },
    "POST /api/v1/cases/case-1/documents": { status: 201, body: { document: { ...DOC, byteSize: 5_000_000 } } },
  };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    backendCalls.push({ path: u.pathname, method, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
    const r = routes[`${method} ${u.pathname}`] ?? { status: 404, body: { error: { code: "CASE_NOT_FOUND" } } };
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  signIn();
  expect((await grant()).status).toBe(200);
  backendCalls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

const uploadedToBackend = () => backendCalls.filter((c) => c.path.endsWith("/documents") && c.method === "POST");

describe("blob token route", () => {
  it("issues a PDF-only, 15 MB, short-lived token inside the household folder", async () => {
    const res = await tokenReq();
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toMatchObject({ ok: true, type: "blob.generate-client-token", clientToken: "client-token" });
    expect(out.opts).toMatchObject({ allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_LARGE_UPLOAD_BYTES, allowOverwrite: false });
    expect(out.opts.validUntil - Date.now()).toBeLessThanOrEqual(5 * 60_000);
    expect(out.opts.validUntil - Date.now()).toBeGreaterThan(0);
  });
  it("tells the page its folder, and that folder holds no household id", async () => {
    const res = await tokenRoute.GET(req("/api/app/documents/blob-token"));
    const out = await res.json();
    expect(out.prefix).toBe(PREFIX);
    expect(out.prefix).not.toContain("h1");
  });
  it("refuses without a session", async () => {
    jar.delete("kv_session");
    expect((await tokenReq()).status).toBe(401);
    expect(blob.handleUpload).not.toHaveBeenCalled();
  });
  it("refuses the demo session", async () => {
    signIn({ t: "demo", h: "demo", m: "demo", a: undefined, demo: true });
    const res = await tokenReq();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("DEMO_READ_ONLY"); // main's readSession refuses demo sessions with a coded 403
    expect(blob.handleUpload).not.toHaveBeenCalled();
  });
  it("refuses without the app header or from another origin", async () => {
    expect((await tokenReq({}, { "x-knowvia-app": "0" })).status).toBe(403);
    expect((await tokenReq({}, { origin: "http://evil.test" })).status).toBe(403);
    expect(blob.handleUpload).not.toHaveBeenCalled();
  });
  it("refuses without the reading go-ahead", async () => {
    jar.delete("kv_docs");
    const res = await tokenReq();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CONSENT_REQUIRED");
  });
  it("refuses when no Blob store is configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = await tokenReq();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("UPLOAD_UNAVAILABLE");
    expect((await tokenRoute.GET(req("/api/app/documents/blob-token"))).status).toBe(503);
  });
  it("refuses a path outside the household folder or with a bad name", async () => {
    for (const pathname of ["uploads/other/abcdefgh12345678.pdf", `${PREFIX}../x.pdf`, `${PREFIX}abc.pdf`, `${PREFIX}abcdefgh12345678.png`, "abcdefgh12345678.pdf"]) {
      const res = await tokenReq({ payload: { pathname, clientPayload: null, multipart: false } });
      expect(res.status, pathname).toBe(400);
    }
  });
  it("does not serve upload-completed callbacks", async () => {
    const res = await tokenReq({ type: "blob.upload-completed" });
    expect(res.status).toBe(400);
    expect(blob.handleUpload).not.toHaveBeenCalled();
  });
  it("sweeps unclaimed blobs older than 30 minutes", async () => {
    blob.list.mockResolvedValue({
      blobs: [
        { url: "https://store/old.pdf", uploadedAt: new Date(Date.now() - 60 * 60_000).toISOString() },
        { url: "https://store/new.pdf", uploadedAt: new Date().toISOString() },
      ],
    });
    await tokenReq();
    expect(blob.list).toHaveBeenCalledWith(expect.objectContaining({ prefix: PREFIX }));
    expect(blob.del).toHaveBeenCalledWith(["https://store/old.pdf"]);
  });
  it("still issues a token when the sweep fails", async () => {
    blob.list.mockRejectedValue(new Error("store down"));
    expect((await tokenReq()).status).toBe(200);
  });
});

describe("from-blob route", () => {
  it("reads the blob, forwards it to the backend like the direct path, then deletes it", async () => {
    blob.get.mockResolvedValue(found(pdf(5_000_000)));
    const res = await claim();
    expect(res.status).toBe(201);
    expect((await res.json()).document.id).toBe("doc-1");
    expect(blob.get).toHaveBeenCalledWith(NAME, expect.objectContaining({ access: "private" }));
    const up = uploadedToBackend();
    expect(up).toHaveLength(1);
    expect((up[0].body as Buffer).byteLength).toBe(5_000_000);
    expect(blob.del).toHaveBeenCalledWith(NAME);
  });
  it("deletes the blob when the backend refuses", async () => {
    blob.get.mockResolvedValue(found(pdf(5_000_000)));
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { code: "PDF_STRUCTURE_INVALID", message: "x" } }), { status: 422 }));
    const res = await claim();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("PDF_UNREADABLE");
    expect(blob.del).toHaveBeenCalledWith(NAME);
  });
  it("deletes the blob when the file is not a PDF", async () => {
    blob.get.mockResolvedValue(found(new TextEncoder().encode("hello, not a pdf")));
    const res = await claim();
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe("FILE_TYPE_INVALID");
    expect(uploadedToBackend()).toHaveLength(0);
    expect(blob.del).toHaveBeenCalledWith(NAME);
  });
  it("refuses a wrong content type and deletes", async () => {
    blob.get.mockResolvedValue(found(pdf(), { contentType: "image/png" }));
    expect((await claim()).status).toBe(415);
    expect(uploadedToBackend()).toHaveLength(0);
    expect(blob.del).toHaveBeenCalledWith(NAME);
  });
  it("refuses a blob over 15 MB by its size and deletes", async () => {
    blob.get.mockResolvedValue(found(pdf(), { size: MAX_LARGE_UPLOAD_BYTES + 1 }));
    const res = await claim();
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("FILE_TOO_LARGE");
    expect(uploadedToBackend()).toHaveLength(0);
    expect(blob.del).toHaveBeenCalledWith(NAME);
  });
  it("refuses a stream longer than 15 MB even if the size lied, and deletes", async () => {
    blob.get.mockResolvedValue(found(pdf(MAX_LARGE_UPLOAD_BYTES + 10), { size: 100 }));
    expect((await claim()).status).toBe(413);
    expect(uploadedToBackend()).toHaveLength(0);
    expect(blob.del).toHaveBeenCalledWith(NAME);
  });
  it("accepts a file between 4 and 15 MB that the direct path would refuse", async () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThan(10 * 1024 * 1024);
    blob.get.mockResolvedValue(found(pdf(10 * 1024 * 1024)));
    expect((await claim()).status).toBe(201);
  });
  it("answers BLOB_MISSING when the blob is not there, and still tries to delete", async () => {
    blob.get.mockResolvedValue(null);
    const res = await claim();
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "BLOB_MISSING", retryable: true });
    expect(uploadedToBackend()).toHaveLength(0);
    expect(blob.del).toHaveBeenCalledWith(NAME);
  });
  it("hides Blob store failures behind a coded error and deletes", async () => {
    blob.get.mockRejectedValue(new Error("Failed to fetch blob: 500 secret store detail"));
    const res = await claim();
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("secret store detail");
    expect(blob.del).toHaveBeenCalledWith(NAME);
  });
  it("still answers when the delete itself fails", async () => {
    blob.get.mockResolvedValue(found(pdf(5_000_000)));
    blob.del.mockRejectedValue(new Error("delete failed"));
    expect((await claim()).status).toBe(201);
  });
  it("never reads or deletes a blob outside the household folder", async () => {
    for (const pathname of ["uploads/aaaaaaaaaaaaaaaaaaaaaaaa/abcdefgh12345678.pdf", `${PREFIX}x/../abcdefgh12345678.pdf`, "other.pdf"]) {
      expect((await claim({ pathname })).status, pathname).toBe(400);
    }
    expect(blob.get).not.toHaveBeenCalled();
    expect(blob.del).not.toHaveBeenCalled();
  });
  it("refuses without a session, as the demo, without consent, or with a bad body", async () => {
    blob.get.mockResolvedValue(found(pdf()));
    expect((await claim({ kind: "nope" })).status).toBe(400);
    expect((await claim({ extra: 1 })).status).toBe(400);
    signIn({ t: "demo", h: "demo", m: "demo", a: undefined, demo: true });
    expect((await claim()).status).toBe(403);
    jar.delete("kv_session");
    expect((await claim()).status).toBe(401);
    expect(blob.get).not.toHaveBeenCalled();
    expect(blob.del).not.toHaveBeenCalled();
  });
  it("refuses without the reading go-ahead and leaves the blob alone", async () => {
    jar.delete("kv_docs");
    const res = await claim();
    expect(res.status).toBe(403);
    expect(blob.get).not.toHaveBeenCalled();
  });
  it("refuses when no Blob store is configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await claim()).status).toBe(503);
    expect(blob.get).not.toHaveBeenCalled();
  });
  it("leaves the 4 MB direct route as it was", async () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(new TextEncoder().encode("%PDF-"));
    const res = await docs.POST(req("/api/app/documents", "POST", { body: big as unknown as BodyInit, headers: { "content-type": "application/pdf", "content-length": String(big.length), "idempotency-key": "key-12345678" } }));
    expect(res.status).toBe(413);
  });
});

describe("list", () => {
  it("reports whether large uploads are available", async () => {
    expect((await (await docs.GET(req("/api/app/documents"))).json()).largeUpload).toBe(true);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await (await docs.GET(req("/api/app/documents"))).json()).largeUpload).toBe(false);
  });
});
