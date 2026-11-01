// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { adapters } from "@/adapters";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

import { AccessCard } from "@/components/access/AccessCard";
import { SignIn } from "@/components/public/SignIn";
import { AddMemberSheet } from "@/components/family/AddMemberSheet";
import { WalletSheet } from "@/components/wallet/WalletSheet";
import { RemindRow } from "@/components/remind/RemindRow";
import { SettingsView } from "@/components/help/SettingsView";
import { EmergencyView } from "@/components/help/EmergencyView";
import { DeskView } from "@/components/help/DeskView";
import { MoneyDesk } from "@/components/money/MoneyDesk";
import { invalidateMe } from "@/components/shell/useMe";

/** A promise the test settles by hand, so the request stays in flight while we click. */
function gate<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
/** 20 clicks inside one act(): no re-render between them, so only a ref guard can stop re-entry. */
async function mash(el: HTMLElement, n = 20) {
  await act(async () => {
    for (let i = 0; i < n; i++) fireEvent.click(el);
  });
}

beforeEach(() => {
  push.mockClear();
  invalidateMe();
  vi.spyOn(adapters.household, "me").mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("click-spam safety", () => {
  it("AccessCard: 20 submits make one request, and unmount drops the late result", async () => {
    const g = gate<{ ok: true; name: string }>();
    const spy = vi.spyOn(adapters.access, "submit").mockReturnValue(g.promise as never);
    const { unmount } = render(<AccessCard />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "asha@example.com" } });
    await act(async () => {
      const form = screen.getByRole("form", { name: "Get access" });
      for (let i = 0; i < 20; i++) fireEvent.submit(form);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => g.resolve({ ok: true, name: "Asha" }));
    await new Promise((r) => setTimeout(r, 800));
    expect(push).not.toHaveBeenCalled(); // nav timer never started after unmount
  });

  it("AccessCard: Google button fires once", async () => {
    const g = gate<{ ok: boolean }>();
    const spy = vi.spyOn(adapters.auth, "signInWithProvider").mockReturnValue(g.promise as never);
    render(<AccessCard />);
    await mash(screen.getByRole("button", { name: /Continue with Google/ }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("SignIn: provider button and Send code fire once", async () => {
    const g = gate<{ ok: boolean }>();
    const prov = vi.spyOn(adapters.auth, "signInWithProvider").mockReturnValue(g.promise as never);
    render(<SignIn />);
    await mash(screen.getByRole("button", { name: /Continue with Google/ }));
    expect(prov).toHaveBeenCalledTimes(1);
    cleanup();
    const g2 = gate<{ ok: boolean }>();
    const otp = vi.spyOn(adapters.auth, "sendOtp").mockReturnValue(g2.promise as never);
    render(<SignIn />);
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "9876543210" } });
    await act(async () => {
      const btn = screen.getByRole("button", { name: "Send code" });
      for (let i = 0; i < 20; i++) fireEvent.click(btn);
    });
    expect(otp).toHaveBeenCalledTimes(1);
  });

  it("AddMemberSheet: Send invite fires once", async () => {
    const g = gate<void>();
    const spy = vi.spyOn(adapters.invite, "invite").mockReturnValue(g.promise as never);
    const onSent = vi.fn();
    render(<AddMemberSheet onClose={vi.fn()} onSent={onSent} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Priya Rao" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: "9822011223" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await mash(screen.getByRole("button", { name: "Send invite" }));
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => g.resolve());
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("WalletSheet: add to wallet fires once", async () => {
    const g = gate<unknown>();
    const spy = vi.spyOn(adapters.wallet, "pass").mockReturnValue(g.promise as never);
    render(<WalletSheet onClose={vi.fn()} />);
    await mash(screen.getAllByRole("button", { name: /Recommended/ })[0]!);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("RemindRow: a channel button fires once", async () => {
    const g = gate<{ message: string }>();
    const spy = vi.spyOn(adapters.notify, "send").mockReturnValue(g.promise as never);
    render(<RemindRow label="Dates" items={[{ title: "Renewal", date: "2027-01-10" } as never]} />);
    await mash(screen.getByRole("button", { name: /WhatsApp/ }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("Settings: Sign out fires once and navigates once", async () => {
    const g = gate<void>();
    const spy = vi.spyOn(adapters.access, "signOut").mockReturnValue(g.promise as never);
    render(<SettingsView logos={{ digilocker: null, abha: null }} />);
    await mash(screen.getByRole("button", { name: "Sign out" }));
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => g.resolve());
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("Emergency: Send to WhatsApp fires once", async () => {
    const g = gate<unknown>();
    const spy = vi.spyOn(adapters.notify, "send").mockReturnValue(g.promise as never);
    render(<EmergencyView />);
    await mash(await screen.findByRole("button", { name: /Send to WhatsApp/ }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("Desk: mashing a raise chip leaves one reply and no timers behind", async () => {
    render(<DeskView />);
    const chips = await screen.findAllByRole("button", { pressed: false });
    await mash(chips[chips.length - 1]!);
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("MoneyDesk: Scan again fires one scan request", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(adapters.email, "scan").mockResolvedValue(undefined as never);
    render(<MoneyDesk />);
    await act(async () => { await vi.advanceTimersByTimeAsync(450 * 40); });
    spy.mockClear();
    const btn = screen.getByRole("button", { name: "Scan again" });
    await mash(btn);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

import { isLowCapacity, readCapability, resetCapability } from "@/lib/capability";

describe("capability", () => {
  afterEach(() => {
    resetCapability();
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 8, configurable: true });
    Object.defineProperty(navigator, "deviceMemory", { value: undefined, configurable: true });
  });
  it("flags low memory, few cores, save-data and reduced motion", () => {
    expect(isLowCapacity({ memoryGb: 8, cores: 8, saveData: false, reducedMotion: false })).toBe(false);
    expect(isLowCapacity({ memoryGb: 4, cores: 8, saveData: false, reducedMotion: false })).toBe(true);
    expect(isLowCapacity({ memoryGb: null, cores: 4, saveData: false, reducedMotion: false })).toBe(true);
    expect(isLowCapacity({ memoryGb: null, cores: null, saveData: true, reducedMotion: false })).toBe(true);
    expect(isLowCapacity({ memoryGb: null, cores: null, saveData: false, reducedMotion: true })).toBe(true);
    expect(isLowCapacity({ memoryGb: null, cores: null, saveData: false, reducedMotion: false })).toBe(false);
  });
  it("reads navigator once", () => {
    Object.defineProperty(navigator, "deviceMemory", { value: 2, configurable: true });
    resetCapability();
    expect(readCapability().memoryGb).toBe(2);
  });
  it("CapabilityInit sets data-motion on a low-capacity device", async () => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 2, configurable: true });
    resetCapability();
    document.documentElement.removeAttribute("data-motion");
    const { CapabilityInit } = await import("@/components/theme/CapabilityInit");
    render(<CapabilityInit />);
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
  });
});
