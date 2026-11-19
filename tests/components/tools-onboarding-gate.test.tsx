// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/tools" }));
import { adapters } from "@/adapters";
import { invalidateMe } from "@/components/shell/useMe";
import { ToolsPage } from "@/components/tools/ToolsPage";
import { OnboardingFlow } from "@/components/onboarding/Flow";

const me = (source: "backend" | "demo") => ({ householdId: "h", householdName: "H", owner: { id: "o", displayName: "Owner" }, source });

beforeEach(() => invalidateMe());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("/tools sample content", () => {
  it("hides the sample policy quote and Read next from a real account", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
    render(<ToolsPage />);
    await waitFor(() => expect(adapters.household.me).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /When does my cover end/ }));
    expect(screen.queryByText(/GROUP POLICY/)).toBeNull();
    expect(screen.queryByText("Read next")).toBeNull();
  });
  it("still shows them to the demo session", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("demo"));
    render(<ToolsPage />);
    fireEvent.click(screen.getByRole("button", { name: /When does my cover end/ }));
    expect(await screen.findByText(/GROUP POLICY/)).toBeInTheDocument();
    expect(await screen.findByText("Read next")).toBeInTheDocument();
  });
});

describe("onboarding reading step", () => {
  it("real account: uses its own holding id, never the sample id or sample rows", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
    vi.spyOn(adapters.policy, "list").mockResolvedValue([{ id: "h-real-1" } as never]);
    const f = vi.spyOn(adapters.reading, "findings").mockResolvedValue([{ policyId: "h-real-1", label: "Room limit", answer: "synthetic", pageRef: "p.1", disagrees: false }]);
    render(<OnboardingFlow slug="reading" />);
    expect(await screen.findByText("Room limit")).toBeInTheDocument();
    expect(f).toHaveBeenCalledWith("h-real-1");
    expect(f).not.toHaveBeenCalledWith("northstar-floater");
    expect(screen.queryByText("Waived (group plan)")).toBeNull();
  });
  it("real account with no holding: skips cleanly, no sample rows", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
    vi.spyOn(adapters.policy, "list").mockResolvedValue([]);
    const f = vi.spyOn(adapters.reading, "findings").mockResolvedValue([]);
    render(<OnboardingFlow slug="reading" />);
    expect(await screen.findByText("No key terms read yet")).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
    expect(screen.queryByText("Family cover")).toBeNull();
  });
  it("demo keeps the sample id and rows", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("demo"));
    const f = vi.spyOn(adapters.reading, "findings").mockResolvedValue([]);
    render(<OnboardingFlow slug="reading" />);
    await waitFor(() => expect(f).toHaveBeenCalledWith("northstar-floater"));
    expect(await screen.findByText("Family cover")).toBeInTheDocument();
  });
});
