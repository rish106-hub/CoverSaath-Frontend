// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/upload" }));

import { UploadView } from "@/components/upload/UploadView";

type Doc = { id: string; kind: string; sizeBytes: number; uploadedAt: string | null; steps: Record<string, string>; note: string | null; busy: boolean };
const doc = (over: Partial<Doc> = {}): Doc => ({
  id: "d1", kind: "policy_wording", sizeBytes: 2048, uploadedAt: null,
  steps: { uploaded: "done", scanned: "done", reading: "done", structured: "done" }, note: null, busy: false, ...over,
});

let consent: boolean;
let documents: Doc[];
let uploadReplies: { status: number; body: unknown }[];
let paths: string[];
let largeUpload = false;

beforeEach(() => {
  consent = false;
  documents = [];
  uploadReplies = [];
  paths = [];
  largeUpload = false;
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    paths.push(`${method} ${path}`);
    const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (path === "/api/app/documents" && method === "GET") return r(200, { ok: true, consent, documents, largeUpload });
    if (path === "/api/app/documents/consent" && method === "POST") { consent = true; return r(200, { ok: true, consent: true }); }
    if (path === "/api/app/documents/consent" && method === "DELETE") { consent = false; documents = []; return r(200, { ok: true, consent: false }); }
    if (path === "/api/app/documents" && method === "POST") {
      const next = uploadReplies.shift() ?? { status: 201, body: { ok: true, document: doc() } };
      return r(next.status, next.body);
    }
    if (method === "DELETE") { documents = []; return r(200, { ok: true }); }
    return r(404, { ok: false, code: "NOT_FOUND", retryable: false });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const pick = (files: File[]) => fireEvent.change(screen.getByTestId("file-input"), { target: { files } });
const pdf = () => new File([new Uint8Array([37, 80, 68, 70, 45])], "policy.pdf", { type: "application/pdf" });

const sized = (size: number) => new File([new Uint8Array(size)], "big.pdf", { type: "application/pdf" });

describe("UploadView size limit", () => {
  it("says 4 MB and refuses a bigger file before sending when there is no Blob store", async () => {
    consent = true;
    render(<UploadView />);
    expect(await screen.findByText("PDF only, up to 4 MB.")).toBeInTheDocument();
    pick([sized(5 * 1024 * 1024)]);
    expect(await screen.findByText(/too big/)).toBeInTheDocument();
    expect(paths.filter((p) => p.startsWith("POST"))).toEqual([]);
  });
  it("says 15 MB and does not refuse a 5 MB file when a Blob store is set up", async () => {
    consent = true;
    largeUpload = true;
    render(<UploadView />);
    expect(await screen.findByText("PDF only, up to 15 MB.")).toBeInTheDocument();
    pick([sized(5 * 1024 * 1024)]);
    await waitFor(() => expect(paths).toContain("GET /api/app/documents/blob-token"));
    expect(screen.queryByText(/too big/)).toBeNull();
  });
});

describe("UploadView", () => {
  it("asks for the go-ahead first and only then shows the drop area", async () => {
    render(<UploadView />);
    expect(await screen.findByText("Before we start")).toBeInTheDocument();
    expect(screen.queryByTestId("file-input")).toBeNull();
    const go = screen.getByRole("button", { name: "Continue" });
    expect(go).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(go);
    expect(await screen.findByTestId("file-input")).toBeInTheDocument();
    expect(paths).toContain("POST /api/app/documents/consent");
  });

  it("refuses a wrong file type on the page without calling the server", async () => {
    consent = true;
    render(<UploadView />);
    await screen.findByTestId("file-input");
    pick([new File(["x"], "photo.png", { type: "image/png" })]);
    expect(await screen.findByText("Only PDF files can be added.")).toBeInTheDocument();
    expect(paths.filter((p) => p === "POST /api/app/documents")).toHaveLength(0);
  });

  it("shows a retryable failure and retries with the same key", async () => {
    consent = true;
    uploadReplies = [{ status: 503, body: { ok: false, code: "BACKEND_UNREACHABLE", retryable: true } }];
    const seen: string[] = [];
    const base = globalThis.fetch;
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
      if (path === "/api/app/documents" && init.method === "POST") seen.push((init.headers as Record<string, string>)["idempotency-key"]);
      return base(path, init);
    });
    render(<UploadView />);
    await screen.findByTestId("file-input");
    pick([pdf()]);
    expect(await screen.findByText("We could not reach the service. Try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("We could not reach the service. Try again.")).toBeNull());
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
    expect(await screen.findByTestId("doc")).toBeInTheDocument();
  });

  it("goes back to the go-ahead step when the server says consent is missing", async () => {
    consent = true;
    uploadReplies = [{ status: 403, body: { ok: false, code: "CONSENT_REQUIRED", retryable: false } }];
    render(<UploadView />);
    await screen.findByTestId("file-input");
    pick([pdf()]);
    expect(await screen.findByText("Before we start")).toBeInTheDocument();
  });

  it("shows the quarantined message and the stepper for a held file", async () => {
    consent = true;
    documents = [doc({ steps: { uploaded: "done", scanned: "unavailable", reading: "pending", structured: "pending" }, note: "QUARANTINED", busy: true })];
    render(<UploadView />);
    expect(await screen.findByText(/held aside/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Progress" })).toBeInTheDocument();
  });

  it("offers a retry when reading stopped, and deletes after a confirmation", async () => {
    consent = true;
    documents = [doc({ steps: { uploaded: "done", scanned: "done", reading: "failed", structured: "pending" }, note: "READING_FAILED" })];
    render(<UploadView />);
    expect(await screen.findByText("We could not read this document. You can try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(screen.queryByTestId("doc")).toBeNull());
    expect(paths).toContain("DELETE /api/app/documents/d1");
  });

  it("shows a sign-in link when the session is gone", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, code: "UNAUTHENTICATED", retryable: false }), { status: 401 }));
    render(<UploadView />);
    expect(await screen.findByText(/Please sign in again/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  });
});
