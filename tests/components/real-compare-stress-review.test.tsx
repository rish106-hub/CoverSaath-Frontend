// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { adapters } from "@/adapters";
import { backendCovers } from "@/adapters/covers";
import { invalidateMe } from "@/components/shell/useMe";
import CompareP from "@/app/(app)/compare/page";
import StressP from "@/app/(app)/stress-test/page";
import ReviewP from "@/app/(app)/review/page";
import { estimate } from "@/lib/real-cover";

const me = (source: "backend" | "demo") => ({ householdId: "h", householdName: "H", owner: { id: "o", displayName: "Owner" }, source });
const money = (r: number) => ({ amountMinor: r * 100, currency: "INR" });
const holding = (id: string, si: number, status = "ready") => ({ id, status, summary: { insurerName: "Test Insurer", productName: `Plan ${id}`, wordingState: "missing", sumInsured: { status: "extracted_unverified", value: money(si) }, policyPeriod: null, premium: null } });
const fact = (factKey: string, value: unknown, unit: string, extra = {}) => ({ factKey, status: "extracted_unverified", value, unit, group: "limits", sources: [], alternatives: [], checkWithInsurer: false, ...extra });

beforeEach(() => invalidateMe());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function real(holdings: unknown[], facts: unknown[] = [], conflicts: unknown[] = []) {
  vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings, creationIssues: [] } as never);
  vi.spyOn(backendCovers, "holdings").mockResolvedValue(holdings as never);
  vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "a", status: "ready", facts, unknownKeys: [] } as never);
  vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "a", status: "ready", conflicts } as never);
}

describe("estimate", () => {
  it("applies co-pay and the sum insured", () => {
    expect(estimate(300000, 500000, null).youPay).toBe(0);
    expect(estimate(300000, 500000, 20).youPay).toBe(60000);
    expect(estimate(700000, 500000, null).youPay).toBe(200000);
  });
});

describe("real compare / stress / review", () => {
  it("empty real account keeps a clean empty state, no mock", async () => {
    real([]);
    const { container } = render(<CompareP />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Meera|Kaveri|Meridian/);
  });
  it("compare shows the real policies side by side", async () => {
    real([holding("a", 500000), holding("b", 1000000)], [fact("room_rent_limit", 500000, "paise")]);
    const { container } = render(<CompareP />);
    expect(await screen.findByText(/Plan a/)).toBeInTheDocument();
    expect(screen.getByText(/Plan b/)).toBeInTheDocument();
    expect(container.textContent).toMatch(/Rs 5,00,000/);
    expect(container.textContent).not.toMatch(/Meera|Kaveri|Meridian/);
  });
  it("stress test works out who pays from the real sum insured", async () => {
    real([holding("a", 500000)], [fact("co_pay", 20, "percent")]);
    const { container } = render(<StressP />);
    fireEvent.change(await screen.findByLabelText(/Hospital bill/), { target: { value: "600000" } });
    expect(screen.getByRole("status").textContent).toMatch(/Rs 1,00,000/);
    expect(container.textContent).not.toMatch(/Meera|Father|Pune/);
  });
  it("review lists real open conflicts and links to settle them", async () => {
    real([holding("a", 500000, "conflicts")], [], [{ id: "c1", factKey: "room_rent_limit", resolution: "pending", reason: "x", candidates: [], checkWithInsurer: false }]);
    render(<ReviewP />);
    const link = await screen.findByRole("link", { name: "Settle it" });
    expect(link.getAttribute("href")).toBe("/covers/review?holding=a");
    expect(screen.getByText(/Room rent limit/)).toBeInTheDocument();
  });
  it("demo session still gets the demo pages", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("demo"));
    render(<ReviewP />);
    expect((await screen.findAllByText(/Knowvia handled/)).length).toBeGreaterThan(0);
  });
});
