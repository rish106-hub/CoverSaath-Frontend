// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import { factsIn, type HoldingView } from "@/adapters/covers-contract";
import { RealPolicyDetail } from "@/components/cover-real/RealPolicyDetail";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const holding = { id: "h1", documentId: "d1", kind: "policy_schedule", status: "ready", summary: { insurerName: "Example Insurer", productName: "Example Health Plan 01", wordingState: "fss", wordingReason: null, sumInsured: null, policyPeriod: null, premium: null } } as unknown as HoldingView;

const fact = (factKey: string, value: unknown, unit: string | null, group: string, page = 4) => ({
  factKey, status: "extracted_unverified", value, unit, valueType: "text", group, sourceTier: "own_pdf",
  sources: [{ id: `s-${factKey}`, tier: "own_pdf", status: "extracted_unverified", page: { pageId: `p${page}`, pageNumber: page, documentKind: "policy_schedule" } }],
});
const SEVEN = [
  fact("sum_insured", { amountMinor: 150000000, currency: "INR" }, "paise", "limits"),
  fact("waiting_initial", { days: 30, original: "30 days" }, "days", "waiting"),
  fact("waiting_ped", { days: 730, original: "2 years" }, "days", "waiting"),
  fact("pre_hospitalisation_days", { days: 60, original: "60 days" }, "days", "cover"),
  fact("post_hospitalisation_days", { days: 90, original: "90 days" }, "days", "cover"),
  fact("seller_name", { text: "X" }, null, "money"),
  fact("clause_ayush", { text: "Covered" }, null, "cover"),
];

function setup(facts: unknown[], unknownKeys: string[]) {
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: [holding], creationIssues: [] });
  vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
  vi.spyOn(backendCovers, "facts").mockResolvedValue(factsIn.parse({ holdingId: "h1", status: "ready", unknownKeys, facts }));
  return render(<RealPolicyDetail id="h1" />);
}
const keys = (n: number) => Array.from({ length: n }, (_, i) => `waiting_specific_${i}`);

describe("policy detail facts", () => {
  it("unknownKeys one row", async () => {
    const { container } = setup([], keys(64));
    const tab = await screen.findByRole("tab", { name: "Not found (64)" });
    expect(screen.getAllByText("Not found (64)")).toHaveLength(1);
    const panel = container.querySelector('[data-panel="not-found"]') as HTMLElement;
    // The first tab starts selected (R5b.3), and Not found is the only group-like tab here, so it is the first.
    expect(panel.hidden).toBe(false);
    expect(panel.querySelectorAll("li")).toHaveLength(64);
    fireEvent.click(screen.getByRole("tab", { name: "Insurer terms" }));
    expect(panel.hidden).toBe(true);
    fireEvent.click(tab);
    expect(panel.hidden).toBe(false);
    expect(container.textContent).not.toContain("Coming soon");
    cleanup(); vi.restoreAllMocks();
    setup([], keys(3));
    expect(await screen.findByRole("tab", { name: "Not found (3)" })).toBeInTheDocument();
    cleanup(); vi.restoreAllMocks();
    setup([], []);
    await screen.findByText("Example Health Plan 01");
    expect(screen.queryByText(/Not found \(/)).toBeNull();
  });
  it("provenance once per fact", async () => {
    const { container } = setup(SEVEN, []);
    await screen.findAllByText("Sum insured");
    // Each fact has its own "Page 4" citation line; the source tag appears once per fact, never beside an identical status chip.
    const cards = container.querySelectorAll('li[class*="fact"]');
    expect(cards.length).toBeGreaterThanOrEqual(7);
    for (const card of Array.from(cards)) {
      const text = card.textContent ?? "";
      expect(text.split("Page 4").length - 1).toBe(1);
    }
  });
  it("7 extracted facts render", async () => {
    const { container } = setup(SEVEN, []);
    await screen.findAllByText("Sum insured");
    const text = container.textContent ?? "";
    for (const s of ["Sum insured", "Rs 15,00,000", "Initial waiting period", "30 days", "Pre-existing disease wait", "Sold by", "AYUSH treatment"]) expect(text).toContain(s);
    for (const s of ["sum_insured", "waiting_ped", "See the document", "[object"]) expect(text).not.toContain(s);
    expect(container.querySelectorAll('[class*="fact"]').length).toBeGreaterThanOrEqual(7);
  });
});
