// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { adapters } from "@/adapters";
import { backendCovers } from "@/adapters/covers";
import type { HoldingView } from "@/adapters/covers-contract";
import { invalidateMe } from "@/components/shell/useMe";
import { DemoGate, EmptyState } from "@/components/shell/EmptyState";

const me = (source: "backend" | "demo" | "mock") => ({ householdId: "h", householdName: "H", owner: { id: "o", displayName: "Owner" }, source });

function view() {
  return render(
    <DemoGate empty={<EmptyState title="Nothing here yet" body="Upload your policy and Knowvia reads it for you." />}>
      <p>Meera Rao mock family</p>
    </DemoGate>,
  );
}

beforeEach(() => invalidateMe());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noHoldings = () => vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: [], creationIssues: [] });

describe("DemoGate", () => {
  it("shows the empty state with an Upload your policy action to a real account with no covers, and no mock content", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
    noHoldings();
    view();
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upload your policy" })).toBeInTheDocument();
    expect(screen.queryByText(/Meera Rao/)).toBeNull();
  });
  it("shows the empty state to a signed-out visitor", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(null);
    view();
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(screen.queryByText(/Meera Rao/)).toBeNull();
  });
  it("shows nothing while the session is unknown, so mock content cannot flash", () => {
    vi.spyOn(adapters.household, "me").mockReturnValue(new Promise(() => undefined));
    view();
    expect(screen.queryByText(/Meera Rao/)).toBeNull();
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });
  it("shows the demo content to the demo session", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("demo"));
    view();
    expect(await screen.findByText(/Meera Rao mock family/)).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });
  it("does not tell a real account that already has a cover to upload one", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
    vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: [{ id: "holding-1" } as unknown as HoldingView], creationIssues: [] });
    view();
    expect(await screen.findByRole("link", { name: "View your covers" })).toHaveAttribute("href", "/policies");
    expect(screen.queryByRole("link", { name: "Upload your policy" })).toBeNull();
  });
  it("shows a retry, not the empty state, when the session check fails", async () => {
    vi.spyOn(adapters.household, "me").mockRejectedValue(new Error("down"));
    view();
    expect(await screen.findByTestId("unreachable-state")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });
  it("shows a retry when the covers cannot be read, and the covers state once the retry works", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
    const spy = vi.spyOn(backendCovers, "holdingsView").mockRejectedValueOnce(Object.assign(new Error("x"), { code: "BACKEND_UNREACHABLE" }));
    spy.mockResolvedValue({ holdings: [{ id: "holding-1" } as unknown as HoldingView], creationIssues: [] });
    view();
    const btn = await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByTestId("empty-state")).toBeNull();
    fireEvent.click(btn);
    expect(await screen.findByRole("link", { name: "View your covers" })).toBeInTheDocument();
  });
});
