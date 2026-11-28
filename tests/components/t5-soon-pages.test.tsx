// @vitest-environment jsdom
// T5: a real account sees no "Coming soon" tiles on seven pages, live emergency links, and no blank state (R3s).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { adapters } from "@/adapters";
import { backendCovers } from "@/adapters/covers";
import { invalidateMe } from "@/components/shell/useMe";
import FamilyP from "@/app/(app)/family/page";
import MoneyP from "@/app/(app)/money/page";
import CardsP from "@/app/(app)/cards/page";
import CompareP from "@/app/(app)/compare/page";
import DeskP from "@/app/(app)/desk/page";
import StressP from "@/app/(app)/stress-test/page";
import EmergencyP from "@/app/(app)/emergency/page";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), redirect }));

const ME = { householdId: "h", householdName: "H", owner: { id: "o", displayName: "Owner" }, source: "backend" as const };

// `ready` is the text a real account lands on once the session is known; no route shows a Soon tile (R3s).
const ROUTES: Record<string, { page: () => ReactElement; ready?: string }> = {
  family: { page: () => <FamilyP />, ready: "People" },
  money: { page: () => <MoneyP />, ready: "No money activity yet" },
  cards: { page: () => <CardsP />, ready: "This page is not available." },
  compare: { page: () => <CompareP />, ready: "Add a policy to compare" },
  desk: { page: () => <DeskP />, ready: "This page is not available." },
  "stress-test": { page: () => <StressP />, ready: "Add a policy to run a stress test" },
  emergency: { page: () => <EmergencyP /> },
};

const soonTiles = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[aria-disabled="true"][title="Coming soon"]'));

function realAccount(holdings: unknown[] = []) {
  vi.spyOn(adapters.household, "me").mockResolvedValue(ME);
  vi.spyOn(adapters.members, "list").mockResolvedValue([]);
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings, creationIssues: [] } as never);
  vi.spyOn(backendCovers, "holdings").mockResolvedValue(holdings as never);
  vi.spyOn(backendCovers, "premiums").mockResolvedValue([]);
  vi.spyOn(backendCovers, "premiumDues").mockResolvedValue([]);
}

async function renderRoute(name: string) {
  const r = render(ROUTES[name].page());
  const { ready } = ROUTES[name];
  if (ready) await screen.findByText(ready);
  else {
    await waitFor(() => expect(adapters.household.me).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
  }
  return r;
}

beforeEach(() => { invalidateMe(); realAccount(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); redirect.mockReset(); });

describe("T5 soon pages", () => {
  it("family shows its real view and no soon tiles", async () => {
    const { container } = await renderRoute("family");
    expect(soonTiles(container)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Add family member" })).toBeInTheDocument();
  });
  it("money shows its real empty state and no soon tiles", async () => {
    const { container } = await renderRoute("money");
    expect(soonTiles(container)).toHaveLength(0);
  });
  it("cards shows not available and no soon tiles", async () => {
    const { container } = await renderRoute("cards");
    expect(soonTiles(container)).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/home");
  });
  it("compare shows its real empty state and no soon tiles", async () => {
    const { container } = await renderRoute("compare");
    expect(soonTiles(container)).toHaveLength(0);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
  it("desk shows not available and no soon tiles", async () => {
    const { container } = await renderRoute("desk");
    expect(soonTiles(container)).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/home");
  });
  it("stress-test shows the bill input and no soon tiles", async () => {
    realAccount([{ id: "a", status: "ready", summary: { insurerName: "Test Insurer", productName: "Plan a", wordingState: "missing", sumInsured: { status: "extracted_unverified", value: { amountMinor: 50000000, currency: "INR" } }, policyPeriod: null, premium: null } }]);
    vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "a", status: "ready", facts: [], unknownKeys: [] } as never);
    render(ROUTES["stress-test"].page());
    expect(await screen.findByLabelText(/Hospital bill/)).toBeInTheDocument();
    expect(soonTiles(document.body as HTMLElement)).toHaveLength(0);
  });
  it("emergency live links and no soon tiles", async () => {
    const { container } = await renderRoute("emergency");
    for (const href of ["tel:112", "tel:108", "/hospitals"]) {
      const links = container.querySelectorAll(`a[href="${href}"]`);
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute("aria-disabled")).toBeNull();
      expect(links[0].closest('[aria-disabled="true"]')).toBeNull();
    }
    expect(soonTiles(container)).toHaveLength(0);
  });
  it("emergency has no animation", async () => {
    vi.spyOn(backendCovers, "holdingsView").mockRejectedValue(new Error("down"));
    const { container } = await renderRoute("emergency");
    for (const el of Array.from(container.querySelectorAll<HTMLElement>("*"))) {
      expect(el.style.animation + el.style.transition).toBe("");
      expect(typeof el.className === "string" ? el.className : "").not.toMatch(/motion|animate|fade|pulse/i);
    }
    expect(container.querySelector('a[href="tel:112"]')).not.toBeNull();
    expect(container.querySelector('a[href="tel:108"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hospitals"]')).not.toBeNull();
  });
  it("emergency links render even when the session lookup is down", async () => {
    vi.spyOn(adapters.household, "me").mockRejectedValue(new Error("down"));
    const { container } = render(<EmergencyP />);
    await screen.findByTestId("unreachable-state");
    for (const href of ["tel:112", "tel:108", "/hospitals"]) expect(container.querySelectorAll(`a[href="${href}"]`)).toHaveLength(1);
  });
  it.each(Object.keys(ROUTES))("every route has no soon tiles, no blank, no sample names: %s", async (name) => {
    const { container } = await renderRoute(name);
    expect(soonTiles(container)).toHaveLength(0);
    expect(screen.queryByText(/Nothing here yet/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Meera|Rohan|Kabir|Mother|Father/);
  });
  it("/assistant redirects to /chat", async () => {
    const mod = await import("@/app/(app)/assistant/page");
    mod.default();
    expect(redirect).toHaveBeenCalledWith("/chat");
  });
});
