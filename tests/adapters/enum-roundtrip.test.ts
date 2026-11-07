import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, onboardingFromWire, onboardingToWire, prefsFromWire, prefsToWire, backendProfile } from "@/adapters/user-data";
import { wireOnboarding, wirePrefs } from "@/adapters/user-data-contract";
import type { UiOnboarding, UiPrefs } from "@/adapters/types";

const none: UiPrefs = { ...DEFAULT_PREFS, sources: { gmail: false, digilocker: false, abha: false }, notify: { whatsapp: false, email: false, calendar: false }, sharing: { rohan: false, mother: false, father: false } };
const rt = (ui: UiPrefs) => prefsFromWire(wirePrefs.parse(prefsToWire(ui)));

describe("enum round trip: every value a screen offers comes back as saved, and the wire form passes the backend allow-list", () => {
  it("connected sources", () => {
    for (const k of ["gmail", "digilocker", "abha"] as const) {
      const ui = { ...none, sources: { ...none.sources, [k]: true } };
      expect(rt(ui)).toEqual(ui);
    }
    const all = { ...none, sources: { gmail: true, digilocker: true, abha: true } };
    expect(rt(all)).toEqual(all);
    expect(rt(none)).toEqual(none);
  });
  it("notification channels", () => {
    for (const k of ["whatsapp", "email", "calendar"] as const) {
      const ui = { ...none, notify: { ...none.notify, [k]: true } };
      expect(rt(ui)).toEqual(ui);
    }
  });
  it("voice language", () => {
    for (const v of ["en", "hi", "both"] as const) expect(rt({ ...none, voice: v }).voice).toBe(v);
  });
  it("family sharing: one switch, on is the default people, off is nobody", () => {
    expect(rt({ ...none, sharing: { ...DEFAULT_PREFS.sharing } }).sharing).toEqual(DEFAULT_PREFS.sharing);
    expect(rt(none).sharing).toEqual(none.sharing);
  });
  it("onboarding way, wallet and people", () => {
    for (const way of ["dl", "up", "hr", "no"] as const) {
      const ui: UiOnboarding = { way, step: 2, completed: false };
      expect(onboardingFromWire(wireOnboarding.parse(onboardingToWire(ui)), false)).toEqual(ui);
    }
    for (const wallet of ["apple", "google", "none", "later"] as const) {
      const ui: UiOnboarding = { wallet, completed: true };
      expect(onboardingFromWire(wireOnboarding.parse(onboardingToWire(ui)), true)).toEqual(ui);
    }
    const people: UiOnboarding = { people: { M: true, R: false, K: true, A: false }, completed: false };
    expect(onboardingFromWire(wireOnboarding.parse(onboardingToWire(people)), false)).toEqual(people);
  });
});

describe("controls the backend cannot store fail loudly, never keep the value for the visit", () => {
  it("mobile number and DigiLocker fetch are refused", async () => {
    await expect(backendProfile.saveContact({ mobile: "9822011223" })).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
    await expect(backendProfile.saveContact({ mobile: "12" })).rejects.toMatchObject({ code: "INVALID_MOBILE" });
    await expect(backendProfile.fetchAddressFromDigiLocker()).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
  });
});
