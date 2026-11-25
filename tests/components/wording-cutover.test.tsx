// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import { factsIn, holdingsIn, type HoldingView } from "@/adapters/covers-contract";
import { mockCovers, setMockHandoff } from "@/adapters/mock/covers";
import { RealPolicyDetail } from "@/components/cover-real/RealPolicyDetail";
import { WAITING_TEXT, isWaitingForWording } from "@/components/cover-real/parts";

// C6 cutover, beta side: while an FSS handoff is open the wording is `missing` with reason `not_checked`. That is waiting, not an error.
// FOR LEGAL REVIEW: the waiting wording is not final. No backend contract change.

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const holding = (wordingState: "missing" | "fss", wordingReason: "not_checked" | "pending" | "no_match" | null): HoldingView => ({
  id: "h1", documentId: "d1", kind: "policy_schedule", status: "ready",
  summary: { insurerName: "Example Insurer", productName: "Example Health Plan 01", wordingState, wordingReason, sumInsured: null, policyPeriod: null, premium: null },
} as unknown as HoldingView);

describe("waiting for the insurer's wording", () => {
  it("only missing + (pending | not_checked) is waiting", () => {
    expect(isWaitingForWording({ wordingState: "missing", wordingReason: "not_checked" })).toBe(true);
    expect(isWaitingForWording({ wordingState: "missing", wordingReason: "pending" })).toBe(true);
    expect(isWaitingForWording({ wordingState: "missing", wordingReason: null })).toBe(false);
    expect(isWaitingForWording({ wordingState: "manual", wordingReason: null })).toBe(false);
    expect(isWaitingForWording({ wordingState: "missing", wordingReason: "no_match" })).toBe(false);
    expect(isWaitingForWording({ wordingState: "fss", wordingReason: null })).toBe(false);
  });
  it("shows the waiting text (no error) and, once the state is fss, refetches and shows the insurer facts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let state: "waiting" | "fss" = "waiting";
    vi.spyOn(backendCovers, "holdingsView").mockImplementation(async () => ({ holdings: [state === "waiting" ? holding("missing", "not_checked") : holding("fss", null)], creationIssues: [] }));
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
    vi.spyOn(backendCovers, "facts").mockImplementation(async () => factsIn.parse({
      holdingId: "h1", status: "ready", unknownKeys: [],
      facts: state === "waiting" ? [] : [{ factKey: "pre_hospitalisation_days", status: "extracted_unverified", value: 60, unit: "days", valueType: "number", group: "cover", sourceTier: "ida_wording", checkWithInsurer: true,
        sources: [{ id: "s", tier: "ida_wording", status: "extracted_unverified", quote: "Up to 60 days before admission.", reference: { source: "fss", pageNumber: 9 } }] }],
    }));
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByText(WAITING_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId("real-error")).toBeNull();
    expect(screen.getByTestId("terms-status")).toHaveAttribute("data-state", "waiting");
    state = "fss";
    await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
    expect(await screen.findByText("Before admission cover")).toBeInTheDocument();
    expect(screen.queryByText(WAITING_TEXT)).toBeNull();
    // T12: an unverified reading no longer repeats its status line on the fact.
    expect(screen.queryByText("From the insurer's wording, not checked")).toBeNull();
  });
  it("the mock has a not_checked state that flips to fss with insurer facts", async () => {
    const id = (await mockCovers.upload(new File([new Uint8Array(64)], "p.pdf", { type: "application/pdf" }), "k-c6-1", { kind: "policy_schedule", policyType: "personal_health" })).holdingId as string;
    await mockCovers.candidates(id);
    await mockCovers.confirmProduct(id, { candidateId: "product-example-02", expectedVersion: 0 }, "k-c6-confirm-1");
    setMockHandoff(id, "open");
    const waiting = (await mockCovers.holdings()).find((x) => x.id === id);
    expect(waiting?.summary).toMatchObject({ wordingState: "missing", wordingReason: "not_checked" });
    expect((await mockCovers.facts(id)).facts.some((f) => f.sourceTier === "ida_wording")).toBe(false);
    setMockHandoff(id, "finish");
    expect((await mockCovers.holdings()).find((x) => x.id === id)?.summary).toMatchObject({ wordingState: "fss", wordingReason: null });
    expect((await mockCovers.facts(id)).facts.some((f) => f.sourceTier === "ida_wording" && f.status === "extracted_unverified")).toBe(true);
  });
  it("pending: keeps the reason through the contract, shows loading (never not attached, no manual button), then flips to attached on the next payload", async () => {
    expect(holdingsIn.parse({ holdings: [{ id: "h1", status: "ready", summary: { wordingState: "missing", wordingReason: "pending" } }] }).holdings[0]?.summary?.wordingReason).toBe("pending");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let state: "pending" | "fss" = "pending";
    vi.spyOn(backendCovers, "holdingsView").mockImplementation(async () => ({ holdings: [state === "pending" ? holding("missing", "pending") : holding("fss", null)], creationIssues: [] }));
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
    vi.spyOn(backendCovers, "facts").mockResolvedValue(factsIn.parse({ holdingId: "h1", status: "ready", unknownKeys: [], facts: [] }));
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByText(WAITING_TEXT)).toBeInTheDocument();
    expect(screen.getByTestId("terms-status")).toHaveAttribute("data-state", "waiting");
    expect(screen.queryByText(/not attached/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Add the terms yourself" })).toBeNull();
    state = "fss";
    await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
    expect(await screen.findByText("Insurer terms attached (verified)")).toBeInTheDocument();
    expect(screen.queryByText(WAITING_TEXT)).toBeNull();
  });
  it("no_match still shows not attached with the manual button", async () => {
    vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: [holding("missing", "no_match")], creationIssues: [] });
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
    vi.spyOn(backendCovers, "facts").mockResolvedValue(factsIn.parse({ holdingId: "h1", status: "ready", unknownKeys: [], facts: [] }));
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByText("Insurer terms not attached yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add the terms yourself" })).toBeInTheDocument();
  });
  it("not_checked (open handoff, can last hours) shows waiting but keeps the manual button", async () => {
    vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: [holding("missing", "not_checked")], creationIssues: [] });
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
    vi.spyOn(backendCovers, "facts").mockResolvedValue(factsIn.parse({ holdingId: "h1", status: "ready", unknownKeys: [], facts: [] }));
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByText(WAITING_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(/not attached/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Add the terms yourself" })).toBeInTheDocument();
  });
  it("the mock passes through missing + pending, then flips to fss", async () => {
    const id = (await mockCovers.upload(new File([new Uint8Array(64)], "p.pdf", { type: "application/pdf" }), "k-98-1", { kind: "policy_schedule", policyType: "personal_health" })).holdingId as string;
    await mockCovers.candidates(id);
    await mockCovers.confirmProduct(id, { candidateId: "product-example-02", expectedVersion: 0 }, "k-98-confirm-1");
    setMockHandoff(id, "pending");
    expect((await mockCovers.holdings()).find((x) => x.id === id)?.summary).toMatchObject({ wordingState: "missing", wordingReason: "pending" });
    setMockHandoff(id, "finish");
    expect((await mockCovers.holdings()).find((x) => x.id === id)?.summary).toMatchObject({ wordingState: "fss", wordingReason: null });
  });
});
