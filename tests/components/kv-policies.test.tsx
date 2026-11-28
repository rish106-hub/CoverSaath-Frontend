// @vitest-environment jsdom
// R3e My policies and policy detail: card grid with a pager, and the detail as header plus tabs. Stubbed backend reads, synthetic data only.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import { AdapterError } from "@/adapters/types";
import { factsIn, type ConflictView, type HoldingView } from "@/adapters/covers-contract";
import { labelOf } from "@/lib/fact-labels";
import { RealPolicies } from "@/components/cover-real/RealPolicies";
import { RealPolicyDetail } from "@/components/cover-real/RealPolicyDetail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SUMMARY: HoldingView["summary"] = {
  insurerName: "Example Insurer", productName: "Example Health Plan 01", wordingState: "fss", wordingReason: null,
  sumInsured: { factKey: "sum_insured", value: { amountMinor: 50000000, currency: "INR" }, status: "extracted_unverified" },
  policyPeriod: { factKey: "policy_period", value: null, status: "conflicting" },
  premium: { factKey: "premium_total", value: null, status: "unknown" },
} as HoldingView["summary"];
const holding = (id: string, status: HoldingView["status"] = "ready", summary: HoldingView["summary"] = SUMMARY): HoldingView => ({ id, documentId: `d-${id}`, kind: "policy_wording", status, summary });
const conflict = (n: number): ConflictView => ({ id: `c${n}`, factKey: "copay_percent", reason: "tier_mismatch", resolution: "pending", checkWithInsurer: false, candidates: [] });
const fact = (factKey: string, group: string) => ({
  factKey, status: "extracted_unverified", value: { text: "Covered" }, unit: null, valueType: "text", group, sourceTier: "own_pdf",
  sources: [{ id: `s-${factKey}`, tier: "own_pdf", status: "extracted_unverified", page: { pageId: "p4", pageNumber: 4, documentKind: "policy_schedule" } }],
});

type Reads = { facts?: unknown[]; unknownKeys?: string[]; conflicts?: ConflictView[]; factsError?: AdapterError };
function stub(holdings: HoldingView[], reads: Reads = {}) {
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings, creationIssues: [] });
  vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: reads.conflicts ?? [] });
  if (reads.factsError) vi.spyOn(backendCovers, "facts").mockRejectedValue(reads.factsError);
  else vi.spyOn(backendCovers, "facts").mockResolvedValue(factsIn.parse({ holdingId: "h1", status: "ready", unknownKeys: reads.unknownKeys ?? [], facts: reads.facts ?? [] }));
}
const many = (n: number) => Array.from({ length: n }, (_, i) => holding(`h${i + 1}`));
const panel = (container: HTMLElement, id: string) => container.querySelector(`[data-panel="${id}"]`) as HTMLElement;

describe("My policies list (R3e.2)", () => {
  it("the list shows the count and an Add a policy link", async () => {
    stub([holding("h1")]);
    const first = render(<RealPolicies />);
    expect(await screen.findByTestId("policy-count")).toHaveTextContent("1 policy");
    expect(screen.getByRole("link", { name: "Add a policy" })).toHaveAttribute("href", "/covers/add");
    first.unmount();
    vi.restoreAllMocks();
    stub(many(2));
    render(<RealPolicies />);
    expect(await screen.findByTestId("policy-count")).toHaveTextContent("2 policies");
  });

  it("each policy is one card that links to its page", async () => {
    stub([holding("h1"), holding("h 2")]);
    render(<RealPolicies />);
    const cards = await screen.findAllByTestId("policy-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].tagName).toBe("A");
    expect(cards[0]).toHaveAttribute("href", "/policies/h1");
    expect(cards[1]).toHaveAttribute("href", "/policies/h%202");
    expect(cards[0]).toHaveAttribute("aria-label", "Example Health Plan 01");
    expect(within(cards[0]).getByRole("heading", { level: 3 })).toHaveTextContent("Example Health Plan 01");
    expect(cards[0]).toHaveTextContent("Example Insurer");
    expect(cards[0]).toHaveTextContent("Sum insured");
  });

  it("headline tones map to green and yellow signals", async () => {
    stub([holding("h1")]);
    render(<RealPolicies />);
    const card = await screen.findByTestId("policy-card");
    // R5a.5: the signal text is the row's label; review and missing show their state as the value on the right.
    const kindOf = (label: string) => [...card.querySelectorAll("[data-kind]")].find((e) => e.textContent === label)?.getAttribute("data-kind");
    expect(kindOf("Sum insured")).toBe("ok");
    expect(kindOf("Policy period")).toBe("warn");
    expect(kindOf("Premium")).toBe("warn");
    expect(within(card).getByText("Needs your decision")).toBeInTheDocument();
    expect(within(card).getByText("Not found yet")).toBeInTheDocument();
    cleanup();
    vi.restoreAllMocks();
    stub([holding("h1", "ready", { ...SUMMARY, sumInsured: { factKey: "sum_insured", value: { amountMinor: 50000000, currency: "INR" }, status: "user_confirmed" } } as HoldingView["summary"])]);
    render(<RealPolicies />);
    const confirmed = await screen.findByTestId("policy-card");
    expect(within(confirmed).getByText("Sum insured").closest("[data-kind]")).toHaveAttribute("data-kind", "ok");
  });

  it("the state signal follows error, reading, choose plan, pending, ready in that order", async () => {
    const cases: { name: string; list: HoldingView[]; reads: Reads; text: string; kind: string }[] = [
      { name: "error", list: [holding("h1")], reads: { factsError: new AdapterError("BACKEND_UNREACHABLE") }, text: "Could not load. Open to try again.", kind: "bad" },
      { name: "reading", list: [holding("h1", "uploaded")], reads: { conflicts: [conflict(1)] }, text: "Still being read", kind: "warn" },
      { name: "choose plan", list: [holding("h1", "insurer_pending")], reads: { conflicts: [conflict(1)] }, text: "Tell us which plan this is", kind: "warn" },
      { name: "one pending", list: [holding("h1", "conflicts")], reads: { conflicts: [conflict(1)] }, text: "One detail needs your decision", kind: "warn" },
      { name: "two pending", list: [holding("h1", "conflicts")], reads: { conflicts: [conflict(1), conflict(2)] }, text: "2 details need your decision", kind: "warn" },
      { name: "ready", list: [holding("h1")], reads: {}, text: "Read and ready", kind: "ok" },
    ];
    for (const c of cases) {
      stub(c.list, c.reads);
      render(<RealPolicies />);
      const card = await screen.findByTestId("policy-card");
      const states = within(card).getAllByText(/Could not load|Still being read|Tell us which plan|details? needs? your decision|Read and ready/);
      expect(states, c.name).toHaveLength(1);
      expect(states[0], c.name).toHaveTextContent(c.text);
      expect(states[0].closest("[data-kind]"), c.name).toHaveAttribute("data-kind", c.kind);
      cleanup();
      vi.restoreAllMocks();
    }
  });

  it("four or fewer policies show no pager", async () => {
    stub(many(4));
    render(<RealPolicies />);
    expect(await screen.findAllByTestId("policy-card")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a fifth policy moves to page two and Back returns", async () => {
    stub(many(5));
    render(<RealPolicies />);
    expect(await screen.findAllByTestId("policy-card")).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent("Page 1 of 2");
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByTestId("policy-card")).toHaveLength(1);
    expect(screen.getByTestId("policy-card")).toHaveAttribute("href", "/policies/h5");
    expect(screen.getByRole("status")).toHaveTextContent("Page 2 of 2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getAllByTestId("policy-card")).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent("Page 1 of 2");
  });

  it("loading, error and empty list states are unchanged", async () => {
    vi.spyOn(backendCovers, "holdingsView").mockReturnValue(new Promise(() => {}));
    const loading = render(<RealPolicies />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My policies");
    expect(screen.queryByTestId("policy-count")).toBeNull();
    expect(screen.queryByTestId("policy-card")).toBeNull();
    loading.unmount();
    vi.restoreAllMocks();
    vi.spyOn(backendCovers, "holdingsView").mockRejectedValue(new AdapterError("BACKEND_UNREACHABLE", true));
    const failed = render(<RealPolicies />);
    expect(await screen.findByTestId("real-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    failed.unmount();
    vi.restoreAllMocks();
    stub([]);
    render(<RealPolicies />);
    expect(await screen.findByTestId("empty-state")).toHaveTextContent("No policies yet");
    expect(screen.getByRole("link", { name: "Add a policy" })).toHaveAttribute("href", "/covers/add");
  });
});

describe("Policy detail (R3e.3)", () => {
  it("detail starts on At a glance with the stage note, pending note and headlines", async () => {
    stub([holding("h1", "conflicts")], { conflicts: [conflict(1)] });
    const { container } = render(<RealPolicyDetail id="h1" />);
    await screen.findByRole("tablist", { name: "Policy sections" });
    expect(screen.getByRole("tab", { name: "At a glance" })).toHaveAttribute("aria-selected", "true");
    const glance = panel(container, "glance");
    expect(glance.hidden).toBe(false);
    expect(within(glance).getByTestId("pending-conflicts")).toHaveTextContent("One detail needs your decision");
    expect(within(glance).getByTestId("headlines")).toBeInTheDocument();
    cleanup();
    vi.restoreAllMocks();
    stub([holding("h1", "insurer_pending", { ...SUMMARY, insurerName: null, productName: null } as HoldingView["summary"])]);
    const second = render(<RealPolicyDetail id="h1" />);
    await screen.findByRole("tablist", { name: "Policy sections" });
    expect(within(panel(second.container, "glance")).getByTestId("stage-note")).toHaveTextContent("Tell us which plan this is");
  });

  it("detail has one tab per fact group that has facts, in the fixed order", async () => {
    stub([holding("h1")], { facts: [fact("sum_insured", "money"), fact("room_rent_limit", "limits"), fact("waiting_initial", "waiting")], unknownKeys: ["waiting_specific_0"] });
    render(<RealPolicyDetail id="h1" />);
    await screen.findByRole("tablist", { name: "Policy sections" });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["At a glance", "Limits", "Waiting", "Money", "Not found (1)", "Insurer terms"]);
  });

  it("choosing a group tab shows its facts and hides the others", async () => {
    stub([holding("h1")], { facts: [fact("room_rent_limit", "limits"), fact("waiting_initial", "waiting")] });
    const { container } = render(<RealPolicyDetail id="h1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Waiting" }));
    expect(screen.getByRole("tab", { name: "Waiting" })).toHaveAttribute("aria-selected", "true");
    expect(panel(container, "waiting").hidden).toBe(false);
    expect(panel(container, "glance").hidden).toBe(true);
    expect(panel(container, "limits").hidden).toBe(true);
    expect(within(panel(container, "waiting")).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  });

  it("a group with nine facts pages at six", async () => {
    const keys = ["room_rent_limit", "copay_percent", "sum_insured", "pre_hospitalisation_days", "post_hospitalisation_days", "clause_ayush", "deductible", "ambulance_limit", "sub_limit"];
    stub([holding("h1")], { facts: keys.map((k) => fact(k, "limits")) });
    const { container } = render(<RealPolicyDetail id="h1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Limits" }));
    const limits = panel(container, "limits");
    expect(within(limits).getAllByRole("listitem")).toHaveLength(6);
    expect(within(limits).getByRole("status")).toHaveTextContent("Page 1 of 2");
    expect(within(limits).getByRole("button", { name: "Back" })).toBeDisabled();
    fireEvent.click(within(limits).getByRole("button", { name: "Next" }));
    expect(within(limits).getAllByRole("listitem")).toHaveLength(3);
    expect(within(limits).getByRole("status")).toHaveTextContent("Page 2 of 2");
  });

  it("Not found tab shows the count and the labels", async () => {
    const unknownKeys = ["waiting_specific_0", "waiting_specific_1"];
    stub([holding("h1")], { unknownKeys });
    const { container } = render(<RealPolicyDetail id="h1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Not found (2)" }));
    const missing = panel(container, "not-found");
    expect(missing.hidden).toBe(false);
    expect(within(missing).getAllByRole("listitem").map((li) => li.textContent)).toEqual(unknownKeys.map((k) => labelOf(k)));
  });

  it("Insurer terms tab appears only when the policy is ready or needs review", async () => {
    const cases: [HoldingView["status"], boolean][] = [["ready", true], ["conflicts", true], ["uploaded", false], ["insurer_pending", false]];
    for (const [status, shown] of cases) {
      stub([holding("h1", status)]);
      render(<RealPolicyDetail id="h1" />);
      await screen.findByRole("tablist", { name: "Policy sections" });
      expect(screen.queryByRole("tab", { name: "Insurer terms" }) !== null, status).toBe(shown);
      cleanup();
      vi.restoreAllMocks();
    }
    stub([holding("h1")]);
    const { container } = render(<RealPolicyDetail id="h1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Insurer terms" }));
    expect(within(panel(container, "terms")).getByTestId("terms-status")).toHaveTextContent("Insurer terms attached (verified)");
  });

  it("detail header links to all policies and to ask about this policy", async () => {
    stub([holding("h1")]);
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Example Health Plan 01");
    expect(screen.getByText("Example Insurer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All policies" })).toHaveAttribute("href", "/policies");
    const ask = screen.getByRole("link", { name: "Ask about this policy" });
    expect(ask).toHaveAttribute("href", "/chat?holding=h1");
    expect(ask.className).toMatch(/cta/);
  });

  it("policy not found and detail error states are unchanged", async () => {
    stub([holding("other")]);
    const missing = render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByText("Policy not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a policy" })).toHaveAttribute("href", "/covers/add");
    missing.unmount();
    vi.restoreAllMocks();
    vi.spyOn(backendCovers, "holdingsView").mockRejectedValue(new AdapterError("BACKEND_UNREACHABLE", true));
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByTestId("real-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
