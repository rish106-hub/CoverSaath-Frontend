// @vitest-environment jsdom
// Home rebuild (T3, reshaped by R3d): cover sentence, one next step and three right cards, no policy cards. Real-account Home rendered against stubbed backend reads.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import type { FactView, HoldingView } from "@/adapters/covers-contract";
import { RealHome } from "@/components/cover-real/RealHome";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fact = (o: Partial<FactView> & { factKey: string }): FactView => ({ status: "extracted_unverified", alternatives: [], checkWithInsurer: false, sources: [], ...o });
const SUMMARY: HoldingView["summary"] = {
  insurerName: "Example Insurer", productName: "Example Health Plan 01",
  sumInsured: { factKey: "sum_insured", value: { amountMinor: 100000000, currency: "INR" }, status: "extracted_unverified" },
  policyPeriod: null, premium: null,
};
const holding = (id: string): HoldingView => ({ id, documentId: `d-${id}`, kind: "policy_wording", status: "ready", summary: SUMMARY });
const RENEWAL = fact({ factKey: "renewal_date", value: "2027-03-14", unit: "iso_date" });
const OTHER = fact({ factKey: "room_rent_limit", value: 500000, unit: "paise", valueType: "number" });

function stub(facts: FactView[]) {
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: [holding("h1"), holding("h2")], creationIssues: [] });
  vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "h1", status: "ready", facts, unknownKeys: [] });
  vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
}
const fixtureA = () => stub([RENEWAL, OTHER]);
const fixtureB = () => stub([OTHER]);
const tileOf = (label: string) => screen.getByText(label).closest("a, div") as HTMLElement;

describe("Home tiles (T3)", () => {
  it("right card labels in order", async () => {
    fixtureA();
    render(<RealHome />);
    const a = await screen.findByText("Policies");
    const b = screen.getByText("Next renewal");
    const c = screen.getAllByText("Ask about your cover").at(-1)!;
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(b.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("right cards show values", async () => {
    fixtureA();
    render(<RealHome />);
    await screen.findByText("Policies");
    expect(tileOf("Policies")).toHaveTextContent("2");
    expect(tileOf("Next renewal").textContent).toContain("2027");
  });

  it("next renewal shows Not in your policy", async () => {
    fixtureB();
    const { container } = render(<RealHome />);
    await screen.findByText("Policies");
    expect(tileOf("Next renewal")).toHaveTextContent("Not in your policy");
    expect(container.textContent).not.toMatch(/Invalid Date|undefined|null/);
  });

  it("ask card has two prompts", async () => {
    fixtureA();
    const { container } = render(<RealHome />);
    await screen.findByText("Policies");
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="/chat?q="]'));
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.textContent)).toEqual(["What are my waiting periods?", "What does my policy not cover?"]);
    expect(links.map((l) => decodeURIComponent(l.getAttribute("href")!.split("q=")[1]))).toEqual(links.map((l) => l.textContent));
  });

  it("no policy cards on Home", async () => {
    fixtureA();
    const { container } = render(<RealHome />);
    await screen.findByText("Policies");
    expect(container.querySelectorAll("article")).toHaveLength(0);
    expect(container.querySelectorAll('article[class*="policyCard"]')).toHaveLength(0);
    expect(screen.queryByText("Your policies")).toBeNull();
    expect(screen.queryByText("All policies")).toBeNull();
  });

  it("single primary CTA", async () => {
    fixtureA();
    const { container } = render(<RealHome />);
    await screen.findByText("Policies");
    expect(container.querySelectorAll('[data-variant="primary"], .btn-primary, button[class*="primary"]').length).toBeLessThanOrEqual(1);
    expect(screen.getByTestId("home-next").closest("a")).toHaveAttribute("href");
  });
});
