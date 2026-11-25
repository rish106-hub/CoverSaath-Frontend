// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Facts } from "@/adapters/covers-contract";

const state = vi.hoisted(() => ({ facts: null as unknown, confirm: vi.fn(), fail: null as unknown }));
vi.mock("@/adapters", () => ({
  adapters: { covers: { facts: async () => state.facts, conflicts: async () => ({ holdingId: "h1", status: "ready", conflicts: [] }), confirmReading: async (...a: unknown[]) => { if (state.fail) throw state.fail; return state.confirm(...a); } } },
}));
vi.mock("@/components/covers/use-holdings", () => ({
  codeOf: (e: unknown) => (e as { code?: string })?.code ?? String(e),
  useHoldings: () => ({ holdings: [{ id: "h1" }], current: { id: "h1" }, select: () => undefined, error: null }),
}));

import { CoverReviewView } from "@/components/covers/CoverReviewView";

const own = { id: "s-own", tier: "own_pdf", status: "extracted_unverified", value: 50000000, quote: "Sum insured Rs 5,00,000", current: true };
const fact = (over: Record<string, unknown> = {}) => ({ factKey: "sum_insured", factClass: "personal_value", valueType: "money", unit: "paise", group: "limits", status: "extracted_unverified", value: 50000000, sourceTier: "own_pdf", alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [own], ...over });
const seed = (...f: unknown[]) => { state.facts = { holdingId: "h1", status: "ready", facts: f, unknownKeys: [] } as Facts; };

beforeEach(() => { state.confirm.mockReset(); state.fail = null; });
afterEach(cleanup);

describe("confirm a printed reading", () => {
  it("shows Confirm for an own-document reading and calls the adapter with its source id", async () => {
    seed(fact());
    state.confirm.mockImplementation(async () => { seed(fact({ status: "user_confirmed", sourceTier: "user_declaration", sources: [own, { id: "d1", tier: "user_declaration", status: "user_confirmed", value: 50000000, captureMethod: "reading_confirm", current: true }] })); return {}; });
    render(<CoverReviewView holding="h1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Sum insured" }));
    await waitFor(() => expect(state.confirm).toHaveBeenCalledWith("h1", "s-own"));
    expect(await screen.findByText("Confirmed by you")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm Sum insured" })).toBeNull();
  });
  it("shows a pending state while the request runs", async () => {
    seed(fact());
    let done: (v: unknown) => void = () => undefined;
    state.confirm.mockReturnValue(new Promise((r) => { done = r; }));
    render(<CoverReviewView holding="h1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Sum insured" }));
    const b = await screen.findByRole("button", { name: "Confirm Sum insured" });
    expect(b).toBeDisabled();
    expect(b.textContent).toBe("Confirming…");
    done({});
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm Sum insured" })).not.toBeDisabled());
  });
  it("offers Confirm for an insurer reading only when it has a quote", async () => {
    const ida = (id: string, quote: string | null) => ({ id, tier: "ida_wording", status: "extracted_unverified", value: 60, quote, current: true });
    seed(
      fact({ factKey: "pre_hospitalisation_days", unit: "days", valueType: "number", sourceTier: "ida_wording", sources: [ida("s-q", "up to 60 days before admission")] }),
      fact({ factKey: "ped_waiting_months", unit: "months", valueType: "number", sourceTier: "ida_wording", sources: [ida("s-n", null)] }),
    );
    render(<CoverReviewView holding="h1" />);
    expect(await screen.findByRole("button", { name: "Confirm Before admission cover" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Confirm / })).toHaveLength(1);
  });
  it("shows no Confirm once a current declaration stands, or for a conflicting fact", async () => {
    seed(
      fact({ sources: [own, { id: "d1", tier: "user_declaration", status: "user_confirmed", value: 1, current: true }] }),
      fact({ factKey: "room_rent_limit", status: "conflicting", value: null, sources: [{ ...own, id: "x" }] }),
    );
    render(<CoverReviewView holding="h1" />);
    await screen.findByText("Sum insured");
    expect(screen.queryAllByRole("button", { name: /^Confirm / })).toHaveLength(0);
  });
  it("on 404 tells the person to refresh", async () => {
    seed(fact());
    state.fail = Object.assign(new Error("gone"), { code: "NOT_FOUND" });
    render(<CoverReviewView holding="h1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Sum insured" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/refresh/i);
  });
});
