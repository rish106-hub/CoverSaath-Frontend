// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Conflicts, Facts } from "@/adapters/covers-contract";

const state = vi.hoisted(() => ({ facts: null as unknown, conflicts: null as unknown, resolve: vi.fn() }));
vi.mock("@/adapters", () => ({
  adapters: { covers: { facts: async () => state.facts, conflicts: async () => state.conflicts, resolveConflict: (...a: unknown[]) => state.resolve(...a) } },
}));
vi.mock("@/components/covers/use-holdings", () => ({
  codeOf: (e: unknown) => String(e),
  useHoldings: () => ({ holdings: [{ id: "h1" }], current: { id: "h1" }, select: () => undefined, error: null }),
}));

import { CoverReviewView } from "@/components/covers/CoverReviewView";

const base = { holdingId: "h1", status: "conflicts" as const };
const fact = (over: Record<string, unknown> = {}) => ({ factKey: "room_rent_limit", factClass: "product_term", valueType: "text", unit: "none", group: "limits", status: "conflicting", value: null, alternatives: [], checkWithInsurer: true, openConflictId: "c1", sources: [], ...over });
const conflict = (over: Record<string, unknown> = {}) => ({
  id: "c1", factKey: "room_rent_limit", factClass: "product_term", valueType: "text", reason: "own_vs_insurer", kind: "own_vs_insurer", resolution: "pending", resolvedAt: null, resolvingFactId: null, checkWithInsurer: true,
  candidates: [
    { id: "own", tier: "own_pdf", source: "own_document", pageNumber: 3, status: "extracted_unverified", value: "1 percent per day", current: true },
    { id: "ref", tier: "ida_wording", source: "reviewed_reference", pageNumber: 12, verificationStatus: "verified", status: "reviewed_reference", value: "2 percent per day", current: true },
  ],
  ...over,
});
const seed = (c: unknown, f: unknown = fact()) => {
  state.facts = { ...base, facts: [f], unknownKeys: [] } as Facts;
  state.conflicts = { ...base, conflicts: [c] } as Conflicts;
};

beforeEach(() => state.resolve.mockReset());
afterEach(cleanup);

describe("own_vs_insurer conflict on the review screen", () => {
  it("names the fact and shows both readings with document and page", async () => {
    seed(conflict());
    render(<CoverReviewView holding="h1" />);
    const card = await screen.findByRole("article", { name: "Room rent limit" });
    expect(card.textContent).toContain("Your schedule says 1 percent per day, insurer terms say 2 percent per day");
    expect(screen.getByText("Your schedule, page 3")).toBeInTheDocument();
    expect(screen.getByText("Insurer terms (verified), page 12")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bUIN\b/i);
  });

  it("uses a supplied document name", async () => {
    seed(conflict({ candidates: [
      { id: "own", source: "own_document", documentName: "Schedule 2026", pageNumber: 1, value: "a", status: "extracted_unverified" },
      { id: "ref", source: "reviewed_reference", documentName: "Product terms", pageNumber: 9, verificationStatus: "verified", value: "b", status: "reviewed_reference" },
    ] }));
    render(<CoverReviewView holding="h1" />);
    expect(await screen.findByText("Schedule 2026, page 1")).toBeInTheDocument();
    expect(screen.getByText("Product terms (verified), page 9")).toBeInTheDocument();
  });

  it("picking a side resolves with that side's id", async () => {
    seed(conflict());
    state.resolve.mockResolvedValue({});
    render(<CoverReviewView holding="h1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Use Insurer terms (verified), page 12 for Room rent limit" }));
    await waitFor(() => expect(state.resolve).toHaveBeenCalledWith("h1", "c1", { chosenFactId: "ref" }));
  });

  it("after resolve the fact reads Confirmed by you", async () => {
    seed(conflict({ resolution: "user_chose" }), fact({ status: "user_confirmed", value: "2 percent per day", sourceTier: "user_declaration", openConflictId: null }));
    render(<CoverReviewView holding="h1" />);
    expect(await screen.findByText("Confirmed by you")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Needs your decision" })).toBeNull();
  });

  it("an unknown kind renders generic copy and still resolves", async () => {
    seed(conflict({ kind: "something_new" }));
    state.resolve.mockResolvedValue({});
    render(<CoverReviewView holding="h1" />);
    const card = await screen.findByRole("article", { name: "Room rent limit" });
    expect(card.textContent).toContain("These readings do not match. Which is right?");
    fireEvent.click(screen.getByRole("button", { name: "Use Your schedule, page 3 for Room rent limit" }));
    await waitFor(() => expect(state.resolve).toHaveBeenCalledWith("h1", "c1", { chosenFactId: "own" }));
  });
});
