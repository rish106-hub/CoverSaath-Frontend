// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { adapters } from "@/adapters";
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

describe("DemoGate", () => {
  it("shows the empty state with an Upload your policy action to a real account, and no mock content", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
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
});
