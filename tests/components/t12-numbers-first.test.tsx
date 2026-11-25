// @vitest-environment jsdom
// T12 numbers-first: the removed filler stays removed. Covers FactItem (citation only, status hidden for unverified readings)
// and the Home tiles (captions only on Next step).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import type { FactLine } from "@/adapters/real-policy";
import { RealHome } from "@/components/cover-real/RealHome";
import { FactItem } from "@/components/cover-real/parts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const factLine = (over: Partial<FactLine> = {}): FactLine => ({
  key: "room_rent_limit", label: "Room rent", value: "Rs 5,000", status: "user_confirmed", statusText: "STATUS_TEXT", sourceText: "Your schedule",
  open: false, citation: "Your document, Page 3", quote: "QUOTE_SENTINEL_XYZ", group: "limits", conflictId: null, ...over,
});
const statusEls = (c: HTMLElement) => [...c.querySelectorAll("*")].filter((e) => /status/i.test(e.className.toString()));

describe("FactItem", () => {
  it("FactItem shows citation, not quote", () => {
    const { container } = render(<ul><FactItem f={factLine()} /></ul>);
    expect(screen.getByText("Your document, Page 3")).toBeInTheDocument();
    expect(screen.queryByText("QUOTE_SENTINEL_XYZ")).toBeNull();
    expect(container.textContent).not.toContain("QUOTE_SENTINEL_XYZ");
  });
  it("FactItem status text", () => {
    const unverified = render(<ul><FactItem f={factLine({ status: "extracted_unverified", statusText: "Read from your document", sourceText: "Your schedule" })} /></ul>);
    expect(statusEls(unverified.container)).toHaveLength(0);
    expect(unverified.container.textContent).not.toContain("Read from your document");
    unverified.unmount();
    // A reading taken from the insurer's wording and not checked keeps its line: it is a trust signal, not filler.
    const insurer = render(<ul><FactItem f={factLine({ status: "extracted_unverified", statusText: "From the insurer's wording, not checked", sourceText: "From the insurer's wording, not checked" })} /></ul>);
    expect(insurer.container.textContent).toContain("From the insurer's wording, not checked");
    insurer.unmount();
    for (const status of ["conflicting", "unknown", "user_confirmed", "reviewed_reference"] as const) {
      const r = render(<ul><FactItem f={factLine({ status, statusText: `Text for ${status}` })} /></ul>);
      const els = statusEls(r.container);
      expect(els.length).toBeGreaterThan(0);
      expect(els[0].textContent).toBe(`Text for ${status}`);
      r.unmount();
    }
  });
});

describe("RealHome tiles", () => {
  it("RealHome tiles: captions only on Next step", async () => {
    vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({
      holdings: [{
        id: "h1", documentId: "d1", kind: "policy_wording", status: "ready",
        summary: { insurerName: "Example Insurer", productName: "Example Health Plan 01", sumInsured: { factKey: "sum_insured", value: { amountMinor: 50000000, currency: "INR" }, status: "extracted_unverified" }, policyPeriod: null, premium: null },
      }],
      creationIssues: [],
    });
    vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "h1", status: "ready", facts: [], unknownKeys: [] });
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
    render(<RealHome />);
    const tile = async (label: string) => (await screen.findByText(label)).closest("a, div[aria-disabled]") as HTMLElement;
    expect(await tile("Policies")).toHaveTextContent(/^Policies1$/);
    expect(await tile("Sum insured")).toHaveTextContent(/^Sum insuredRs 5,00,000$/);
    expect((await tile("Next step")).textContent).toContain("Ask about your cover");
    expect((await tile("Next step")).textContent).toContain("Questions answered from your policy");
    expect(await tile("Cover per person")).toHaveTextContent(/^Cover per person/);
    expect((await tile("Cover per person")).textContent).not.toContain("See who is covered");
    expect(screen.queryByText("on your account")).toBeNull();
  });
});
