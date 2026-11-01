// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { adapters, AdapterError, addressSchema, mobileSchema } from "@/adapters";
import { resetMockProfile } from "@/adapters/mock/profile";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/profile",
}));

import { ProfileView } from "@/components/profile/ProfileView";
import { SaveState } from "@/components/ui/SaveState";
import { invalidateMe } from "@/components/shell/useMe";
import { SHORTCUTS } from "@/lib/shortcuts";
import { roundCoarse } from "@/lib/india";

const view = () => render(<ProfileView logos={{ digilocker: <i>DL</i>, abha: <i>AB</i> }} />);
const ready = async () => { await screen.findByLabelText("Mobile number"); };

function gate<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
async function mash(el: HTMLElement, n = 20) {
  await act(async () => { for (let i = 0; i < n; i++) fireEvent.click(el); });
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function fillAddress() {
  type("Address line 1", "22, Park Road");
  type("City", "Pune");
  fireEvent.change(screen.getByLabelText("State"), { target: { value: "Maharashtra" } });
  type("Pincode", "411001");
}

beforeEach(() => {
  push.mockClear();
  invalidateMe();
  resetMockProfile();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("profile page", () => {
  it("renders every section", async () => {
    view();
    await ready();
    for (const h of ["You", "Registered address (optional)", "Location", "Connected sources", "Your account"]) {
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Fetch from DigiLocker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add it yourself" })).toBeInTheDocument();
    expect(screen.getByText("Gmail")).toBeInTheDocument();
    expect(screen.getByText("Not asked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("validates mobile and pincode", () => {
    expect(mobileSchema.safeParse("98765 43210").data).toBe("+919876543210");
    expect(mobileSchema.safeParse("+91 9876543210").success).toBe(true);
    expect(mobileSchema.safeParse("12345").success).toBe(false);
    expect(mobileSchema.safeParse("5876543210").success).toBe(false);
    const base = { line1: "a", city: "b", state: "c", pincode: "560038" };
    expect(addressSchema.safeParse(base).success).toBe(true);
    expect(addressSchema.safeParse({ ...base, pincode: "060038" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, pincode: "56003" }).success).toBe(false);
  });

  it("rejects a bad mobile in the form and saves a good one", async () => {
    const spy = vi.spyOn(adapters.profile, "saveContact");
    view();
    await ready();
    type("Mobile number", "123");
    fireEvent.click(screen.getByRole("button", { name: "Save mobile number" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/10-digit/);
    expect(spy).not.toHaveBeenCalled();
    type("Mobile number", "9876543210");
    fireEvent.click(screen.getByRole("button", { name: "Save mobile number" }));
    await screen.findByText("Saved");
    expect(spy).toHaveBeenCalledWith({ mobile: "+919876543210" });
  });

  it("DigiLocker fetch success fills the card", async () => {
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Fetch from DigiLocker" }));
    expect(await screen.findByText(/Lakeview Residency/)).toBeInTheDocument();
    expect(screen.getByText("From DigiLocker")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("DigiLocker failure shows a calm error and the manual form", async () => {
    vi.spyOn(adapters.profile, "fetchAddressFromDigiLocker").mockRejectedValue(new AdapterError("DIGILOCKER_DOWN", true));
    const save = vi.spyOn(adapters.profile, "saveAddress");
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Fetch from DigiLocker" }));
    expect(await screen.findByText(/could not reach DigiLocker/)).toBeInTheDocument();
    expect(screen.getByLabelText("Address line 1")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("manual save, then Edit and Remove", async () => {
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add it yourself" }));
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect((await screen.findAllByText("Required")).length).toBeGreaterThan(0);
    await fillAddress();
    type("Pincode", "0123");
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByText(/6-digit pincode/)).toBeInTheDocument();
    type("Pincode", "411001");
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByText(/Pune, Maharashtra 411001/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("City")).toHaveValue("Pune");
    type("City", "Nashik");
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByText(/Nashik, Maharashtra/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Fetch from DigiLocker" })).toBeInTheDocument());
  });

  it("a failed save keeps what the person typed and offers Retry", async () => {
    vi.spyOn(adapters.profile, "saveAddress").mockRejectedValueOnce(new AdapterError("DOWN", true));
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add it yourself" }));
    await fillAddress();
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    await screen.findByText(/Could not save/);
    expect(screen.getByLabelText("Address line 1")).toHaveValue("22, Park Road");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/Pune, Maharashtra 411001/)).toBeInTheDocument();
  });

  it("double click on Save address sends one saveAddress", async () => {
    const g = gate<never>();
    const spy = vi.spyOn(adapters.profile, "saveAddress").mockReturnValue(g.promise as never);
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add it yourself" }));
    await fillAddress();
    await act(async () => {
      const form = screen.getByRole("form", { name: "Registered address" });
      for (let i = 0; i < 20; i++) fireEvent.submit(form);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("Sign out fires once", async () => {
    const g = gate<void>();
    const spy = vi.spyOn(adapters.access, "signOut").mockReturnValue(g.promise as never);
    view();
    await ready();
    await mash(screen.getByRole("button", { name: "Sign out" }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("location", () => {
  const stubGeo = (impl: (ok: PositionCallback, err: PositionErrorCallback) => void) =>
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { geolocation: { getCurrentPosition: impl } }));

  it("granted: saves a coarse, rounded position and Clear removes it", async () => {
    stubGeo((ok) => ok({ coords: { latitude: 12.971598, longitude: 77.594566, accuracy: 35.4 } } as GeolocationPosition));
    const save = vi.spyOn(adapters.profile, "saveCurrentLocation");
    const perm = vi.spyOn(adapters.profile, "setPermission");
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Allow location" }));
    expect(await screen.findByText("Current place: about 1 km (kept for 24 hours)")).toBeInTheDocument();
    expect(screen.getByTestId("location-state")).toHaveTextContent("Allowed");
    expect(perm).toHaveBeenCalledWith("location", "granted", "settings");
    expect(save).toHaveBeenCalledWith({ lat: 12.97, lng: 77.59, accuracyM: 35, precision: "coarse" });
    const clear = vi.spyOn(adapters.profile, "clearCurrentLocation");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(screen.queryByText(/Current place/)).not.toBeInTheDocument());
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("denied: records Not allowed and shows a calm message", async () => {
    stubGeo((_ok, err) => err({ code: 1, message: "denied" } as GeolocationPositionError));
    const perm = vi.spyOn(adapters.profile, "setPermission");
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Allow location" }));
    expect(await screen.findByText(/Location is not allowed/)).toBeInTheDocument();
    expect(screen.getByTestId("location-state")).toHaveTextContent("Not allowed");
    expect(perm).toHaveBeenCalledWith("location", "denied", "settings");
    expect(screen.queryByText(/Current place/)).not.toBeInTheDocument();
  });

  it("unavailable: says so and records nothing", async () => {
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { geolocation: undefined }));
    const perm = vi.spyOn(adapters.profile, "setPermission");
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Allow location" }));
    expect(await screen.findByText(/cannot share its location/)).toBeInTheDocument();
    expect(perm).not.toHaveBeenCalled();
    expect(screen.getByTestId("location-state")).toHaveTextContent("Not asked");
  });

  it("the mock adapter rounds coarse positions and keeps exact ones", async () => {
    expect(roundCoarse(12.976)).toBe(12.98);
    const coarse = await adapters.profile.saveCurrentLocation({ lat: 12.9716, lng: 77.5946, accuracyM: 10, precision: "coarse" });
    expect(coarse).toMatchObject({ lat: 12.97, lng: 77.59 });
    const exact = await adapters.profile.saveCurrentLocation({ lat: 12.9716, lng: 77.5946, accuracyM: 10, precision: "exact" });
    expect(exact.lat).toBe(12.9716);
  });

  it("revoking location erases the saved position", async () => {
    await adapters.profile.saveCurrentLocation({ lat: 1, lng: 2, accuracyM: 5, precision: "coarse" });
    await adapters.profile.setPermission("location", "revoked", "settings");
    expect((await adapters.profile.get()).currentLocation).toBeNull();
  });

  it("saved places can be added and removed", async () => {
    view();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add place" }));
    expect(await screen.findByText("Enter the address.")).toBeInTheDocument();
    type("Address", "7, Green Lane");
    fireEvent.click(screen.getByRole("button", { name: "Add place" }));
    expect(await screen.findByText("7, Green Lane")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Home" }));
    await waitFor(() => expect(screen.queryByText("7, Green Lane")).not.toBeInTheDocument());
  });
});

describe("SaveState", () => {
  it("announces politely and shows each state", () => {
    const { rerender, container } = render(<SaveState status="saving" />);
    expect(container.firstChild).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Saving")).toBeInTheDocument();
    rerender(<SaveState status="saved" />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    const retry = vi.fn();
    rerender(<SaveState status="error" onRetry={retry} />);
    fireEvent.click(within(container).getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });
});

describe("profile shortcut", () => {
  it("G then U opens the profile without colliding", () => {
    const hit = SHORTCUTS.find((s) => s.id === "go-profile");
    expect(hit?.href).toBe("/profile");
    const seq = SHORTCUTS.filter((s) => s.keys.length === 2).map((s) => s.keys.join(""));
    expect(new Set(seq).size).toBe(seq.length);
  });
});
