// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The backend as data source: every control without a backend field is off.
vi.mock("@/adapters/features", async (orig) => {
  const m = await orig<typeof import("@/adapters/features")>();
  return { ...m, features: { profileMobile: false, digilockerFetch: false, memberContact: false, advisorBooking: false, perPersonSharing: false } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/profile",
}));
vi.mock("@/components/shell/FamilyOwner", () => ({ FamilyOwner: () => <div /> }));

import { adapters } from "@/adapters";
import { ProfileView } from "@/components/profile/ProfileView";
import { SettingsView } from "@/components/help/SettingsView";
import { ThemeProvider } from "@/components/theme";
import { ToolsPage } from "@/components/tools/ToolsPage";
import { FamilyView } from "@/components/family/FamilyView";
import { resetMockProfile } from "@/adapters/mock/profile";

afterEach(cleanup);

describe("flag-off controls are not shown", () => {
  it("Profile has no Contact section and no DigiLocker fetch", async () => {
    resetMockProfile();
    render(<ProfileView logos={{ digilocker: <i>DL</i>, abha: <i>AB</i> }} />);
    await screen.findByRole("button", { name: "Add your address" });
    expect(screen.queryByLabelText("Mobile number")).toBeNull();
    expect(screen.queryByRole("link", { name: "Contact" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Fetch from DigiLocker/ })).toBeNull();
  });

  it("Settings shows one family-view switch, not one per person", async () => {
    render(<ThemeProvider><SettingsView logos={{ digilocker: null, abha: null }} /></ThemeProvider>);
    expect(await screen.findByRole("switch", { name: "Family view" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Share with Father" })).toBeNull();
  });

  it("Tools has no Advisors booking", () => {
    render(<ToolsPage />);
    expect(screen.queryByText("Advisors")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Book with/ })).toBeNull();
  });

  it("Add family member asks for name and relation only, stores the member and sends no invite", async () => {
    const add = vi.spyOn(adapters.members, "add");
    const invite = vi.spyOn(adapters.invite, "invite");
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: "Add family member" }));
    expect(screen.queryByLabelText("Mobile number")).toBeNull();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Anika Rao" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to household" }));
    await waitFor(() => expect(add).toHaveBeenCalledWith({ name: "Anika Rao", relation: expect.any(String) }));
    expect(invite).not.toHaveBeenCalled();
    expect(await screen.findByText("Added to your household")).toBeInTheDocument();
    expect(screen.queryByText(/Sent just now/)).toBeNull();
  });
});
