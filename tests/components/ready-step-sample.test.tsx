// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/welcome/ready" }));
import { adapters } from "@/adapters";
import { invalidateMe } from "@/components/shell/useMe";
import { OnboardingFlow } from "@/components/onboarding/Flow";

const me = (source: "backend" | "demo") => ({ householdId: "h", householdName: "H", owner: { id: "o", displayName: "Owner" }, source });

beforeEach(() => invalidateMe());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("/welcome/ready sample card", () => {
  it("real account: no wallet button, no sample wins, no sample card", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("backend"));
    render(<OnboardingFlow slug="ready" />);
    await waitFor(() => expect(adapters.household.me).toHaveBeenCalled());
    await screen.findByRole("link", { name: "Go to my home" });
    expect(screen.queryByRole("button", { name: /Save card to wallet/ })).toBeNull();
    expect(screen.queryByText("Family cover")).toBeNull();
    expect(screen.queryByText(/Meera/)).toBeNull();
  });
  it("shows nothing sample while loading", () => {
    vi.spyOn(adapters.household, "me").mockReturnValue(new Promise(() => {}));
    render(<OnboardingFlow slug="ready" />);
    expect(screen.queryByRole("button", { name: /Save card to wallet/ })).toBeNull();
  });
  it("demo: wallet button opens the sample card", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(me("demo"));
    render(<OnboardingFlow slug="ready" />);
    fireEvent.click(await screen.findByRole("button", { name: /Save card to wallet/ }));
    expect((await screen.findAllByText(/Meera/)).length).toBeGreaterThan(0);
  });
});
