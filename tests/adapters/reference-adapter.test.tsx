// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { adapters, AdapterError } from "@/adapters";
import { backendReference } from "@/adapters/reference";
import { referenceProductsOut } from "@/adapters/reference-contract";
import { ProductReference } from "@/components/reference/ProductReference";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("reference adapter (demo/mock)", () => {
  it("returns the synthetic fixture in the contract shape", async () => {
    const r = await adapters.reference.products({ uin: "synthetic-test-only/01" });
    referenceProductsOut.parse({ ...r });
    expect(r.products).toHaveLength(1);
    expect((await adapters.reference.products({ q: "no such plan" })).products).toEqual([]);
  });
});

describe("reference adapter (BFF client)", () => {
  const stub = (status: number, body: unknown) => vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status }));
  it("carries the BFF error code through", async () => {
    stub(503, { ok: false, code: "REFERENCE_UNAVAILABLE", retryable: false });
    await expect(backendReference.products({ q: "plan" })).rejects.toMatchObject({ code: "REFERENCE_UNAVAILABLE" });
  });
  it("rejects a malformed answer and a bad query without fetching", async () => {
    stub(200, { products: "x" });
    await expect(backendReference.products({ q: "plan" })).rejects.toMatchObject({ code: "BACKEND_BAD_RESPONSE" });
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(backendReference.products({ q: "" })).rejects.toBeInstanceOf(AdapterError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("ProductReference states", () => {
  it("shows loading then data", async () => {
    render(<ProductReference query={{ uin: "SYNTHETIC-TEST-ONLY/01" }} />);
    expect(screen.getByRole("status")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Example Health Plan 01")).toBeTruthy());
  });
  it("shows empty", async () => {
    render(<ProductReference query={{ q: "nothing matches" }} />);
    await waitFor(() => expect(screen.getByText("No matching product found.")).toBeTruthy());
  });
  it("shows not-available for REFERENCE_UNAVAILABLE", async () => {
    vi.spyOn(adapters.reference, "products").mockRejectedValue(new AdapterError("REFERENCE_UNAVAILABLE"));
    render(<ProductReference query={{ q: "plan" }} />);
    await waitFor(() => expect(screen.getByText(/not available right now/)).toBeTruthy());
  });
  it("shows an error for other failures", async () => {
    vi.spyOn(adapters.reference, "products").mockRejectedValue(new AdapterError("BACKEND_BAD_RESPONSE"));
    render(<ProductReference query={{ q: "plan" }} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
  it("copy has no defensive labels", async () => {
    render(<ProductReference query={{ uin: "SYNTHETIC-TEST-ONLY/01" }} />);
    await waitFor(() => screen.getByText("Example Health Plan 01"));
    expect(document.body.textContent).not.toMatch(/sample|demo|preview|draft|placeholder|not advice/i);
  });
});
