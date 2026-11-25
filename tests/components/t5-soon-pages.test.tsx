// @vitest-environment jsdom
// T5: a real account sees a row of "Coming soon" tiles on seven pages, live emergency links, and no blank state.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

const ROUTES: Record<string, { page: () => ReactElement; labels: string[] }> = {
  family: { page: () => <FamilyP />, labels: ["People and relations", "Who is covered by what", "Invite family"] },
  money: { page: () => <MoneyP />, labels: ["Premiums this year", "Tax you can save (80D)", "Receipts", "Renewal reminders", "Claims paid", "Download 80D pack"] },
  cards: { page: () => <CardsP />, labels: ["E-cards", "Add to wallet", "Share a card"] },
  compare: { page: () => <CompareP />, labels: ["Plans in your cover band", "Top-ups", "Talk to an advisor"] },
  desk: { page: () => <DeskP />, labels: ["Open claims", "Insurer conversations", "Documents to sign"] },
  "stress-test": { page: () => <StressP />, labels: ["Pick a procedure", "Insurer pays vs you pay", "With a top-up"] },
  emergency: { page: () => <EmergencyP />, labels: ["E-card for the desk", "Blood availability", "Share location with family"] },
};

const soonTiles = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[aria-disabled="true"][title="Coming soon"]'));
const tileLabels = (c: HTMLElement) => soonTiles(c).map((t) => (t.textContent ?? "").replace(/Coming soon$/, ""));

function realAccount(holdings: unknown[] = []) {
  vi.spyOn(adapters.household, "me").mockResolvedValue(ME);
  vi.spyOn(adapters.members, "list").mockResolvedValue([]);
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings, creationIssues: [] } as never);
  vi.spyOn(backendCovers, "holdings").mockResolvedValue(holdings as never);
}

async function renderRoute(name: string) {
  const r = render(ROUTES[name].page());
  const labels = ROUTES[name].labels;
  await screen.findByText(labels[0]);
  return r;
}

beforeEach(() => { invalidateMe(); realAccount(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); redirect.mockReset(); });

describe("T5 soon pages", () => {
  it("family renders 3 soon tiles", async () => {
    const { container } = await renderRoute("family");
    expect(tileLabels(container)).toEqual(ROUTES.family.labels);
    expect(screen.getByRole("button", { name: "Add family member" })).toBeInTheDocument();
  });
  it("money renders 6 soon tiles", async () => {
    const { container } = await renderRoute("money");
    expect(tileLabels(container)).toEqual(ROUTES.money.labels);
  });
  it("cards renders 3 soon tiles", async () => {
    const { container } = await renderRoute("cards");
    expect(tileLabels(container)).toEqual(ROUTES.cards.labels);
  });
  it("compare renders 3 soon tiles plus real rows", async () => {
    const { container } = await renderRoute("compare");
    expect(tileLabels(container)).toEqual(ROUTES.compare.labels);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
  it("desk renders 3 soon tiles", async () => {
    const { container } = await renderRoute("desk");
    expect(tileLabels(container)).toEqual(ROUTES.desk.labels);
  });
  it("stress-test renders 3 soon tiles plus bill input", async () => {
    realAccount([{ id: "a", status: "ready", summary: { insurerName: "Test Insurer", productName: "Plan a", wordingState: "missing", sumInsured: { status: "extracted_unverified", value: { amountMinor: 50000000, currency: "INR" } }, policyPeriod: null, premium: null } }]);
    vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "a", status: "ready", facts: [], unknownKeys: [] } as never);
    const { container } = await renderRoute("stress-test");
    expect(tileLabels(container)).toEqual(ROUTES["stress-test"].labels);
    expect(await screen.findByLabelText(/Hospital bill/)).toBeInTheDocument();
  });
  it("emergency live links and soon tiles", async () => {
    const { container } = await renderRoute("emergency");
    for (const href of ["tel:112", "tel:108", "/hospitals"]) {
      const links = container.querySelectorAll(`a[href="${href}"]`);
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute("aria-disabled")).toBeNull();
      expect(links[0].closest('[aria-disabled="true"]')).toBeNull();
    }
    expect(tileLabels(container)).toEqual(ROUTES.emergency.labels);
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
  it.each(Object.keys(ROUTES))("every route has 3-col bento, no blank, no sample names: %s", async (name) => {
    const { container } = await renderRoute(name);
    expect(container.querySelector('[class*="cols3"]')).not.toBeNull();
    expect(soonTiles(container).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Nothing here yet/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Meera|Rohan|Kabir|Mother|Father/);
  });
  it("/assistant redirects to /chat", async () => {
    const mod = await import("@/app/(app)/assistant/page");
    mod.default();
    expect(redirect).toHaveBeenCalledWith("/chat");
  });
});
