// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Consent and upload page: loading, error with Retry (never the raw error, never the consent form after a failed read), and the plan lookup retry.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/covers/add" }));
vi.mock("@/adapters", async () => {
  const { mockCovers } = await import("@/adapters/mock/covers");
  return { adapters: { covers: mockCovers, reference: { products: async () => ({ products: [] }) }, members: { list: async () => [], add: async (input: { name: string; relation: string }) => ({ id: "member-1", name: input.name, relation: input.relation, ageYears: null, isOwner: false, isYou: false }) } } };
});
vi.hoisted(() => { process.env.NEXT_PUBLIC_ADAPTERS = "mock"; });

import { AddCoverView } from "@/components/covers/AddCoverView";
import { mockCovers } from "@/adapters/mock/covers";
import { AdapterError } from "@/adapters/types";
import { mockUploads as uploads } from "@/adapters/mock/uploads";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("consent and upload states", () => {
  it("shows a loading state while consent is being read", () => {
    vi.spyOn(uploads, "list").mockReturnValue(new Promise(() => undefined));
    render(<AddCoverView />);
    expect(screen.getByLabelText("Loading your upload page")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("a failed read shows a plain-English error with Retry, not the consent form, and Retry recovers", async () => {
    const list = vi.spyOn(uploads, "list").mockRejectedValueOnce(new Error("ECONNRESET 10.0.0.4:5432"));
    render(<AddCoverView />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not reach the service/i);
    expect(document.body.textContent).not.toMatch(/ECONNRESET|5432/);
    expect(screen.queryByRole("checkbox")).toBeNull();
    list.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Yes, read my policy" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("an expired session on load offers sign in, not a retry loop", async () => {
    vi.spyOn(uploads, "list").mockRejectedValue(new AdapterError("UNAUTHENTICATED"));
    render(<AddCoverView />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("plan lookup failure after upload offers Try again", async () => {
    const cands = vi.spyOn(mockCovers, "candidates").mockRejectedValueOnce(new Error("boom"));
    render(<AddCoverView />);
    fireEvent.click(await screen.findByRole("button", { name: "Yes, read my policy" }));
    await screen.findByTestId("policy-type");
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [new File([new Uint8Array(8)], "schedule.pdf", { type: "application/pdf" })] } });
    const retry = await screen.findByRole("button", { name: "Try again" });
    cands.mockRestore();
    fireEvent.click(retry);
    expect(await screen.findByRole("heading", { name: "Which plan is this?" })).toBeTruthy();
  });
});
