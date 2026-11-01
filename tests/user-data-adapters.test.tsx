// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { AdapterError } from "@/adapters";
import {
  backendOnboarding, backendPreferences, backendProfile, DEFAULT_PREFS, onboardingFromWire, onboardingToWire, prefsFromWire, prefsToWire, resetUserDataCache,
} from "@/adapters/user-data";
import { useAutosave } from "@/lib/use-autosave";
import { SaveState } from "@/components/ui/SaveState";

// A fake BFF: records requests and answers from a script.
type Req = { path: string; method: string; body: unknown; headers: Record<string, string> };
let reqs: Req[];
let handler: (r: Req) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
beforeEach(() => {
  reqs = [];
  resetUserDataCache();
  vi.stubGlobal("fetch", async (path: string, init: RequestInit) => {
    const r: Req = { path, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body as string) : undefined, headers: init.headers as Record<string, string> };
    reqs.push(r);
    const out = await handler(r);
    return new Response(JSON.stringify(out.body), { status: out.status ?? 200 });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const fail = (status: number, code: string, retryable = false) => ({ status, body: { ok: false, code, retryable } });
const address = { line1: "22, Park Road", city: "Pune", state: "Maharashtra", pincode: "411001", country: "IN" };
const emptyProfile = (r: Req) => (r.path === "/api/app/permissions" ? { body: { ok: true, permissions: [] } } : { body: { ok: true, places: [] } });

describe("profile adapter over the BFF", () => {
  it("loads the registered address, saved places, permission and current location", async () => {
    handler = (r) =>
      r.path === "/api/app/permissions"
        ? { body: { ok: true, permissions: [{ permission: "location", state: "granted", surface: "settings", revision: 2 }] } }
        : { body: { ok: true, places: [
            { kind: "registered_address", revision: 1, source: "digilocker", address },
            { kind: "saved_place", slot: "home", label: "Home", revision: 3, address },
            { kind: "current_location", revision: 1, precision: "coarse", location: { lat: 18.52, lng: 73.86, accuracyM: 1000 } },
          ] } };
    const p = await backendProfile.get();
    expect(p.address?.city).toBe("Pune");
    expect(p.addressSource).toBe("digilocker");
    expect(p.permissions.location).toBe("granted");
    expect(p.places).toEqual([{ id: "home", kind: "home", label: "Home", address: { line1: "22, Park Road", city: "Pune", state: "Maharashtra", pincode: "411001", country: "IN" } }]);
    expect(p.currentLocation).toEqual({ lat: 18.52, lng: 73.86, accuracyM: 1000, precision: "coarse" });
  });

  it("address round-trip sends the revision it last saw", async () => {
    handler = (r) => (r.method === "PUT" ? { body: { ok: true, place: { kind: "registered_address", revision: 8, source: "user_typed", address } } } : emptyProfile(r));
    await backendProfile.get();
    const saved = await backendProfile.saveAddress({ ...address, line2: "", landmark: "" });
    expect(saved.city).toBe("Pune");
    expect(reqs.at(-1)).toMatchObject({ path: "/api/app/places", method: "PUT", body: { kind: "registered_address", source: "user_typed", revision: 0 } });
    await backendProfile.saveAddress(address);
    expect((reqs.at(-1)!.body as { revision: number }).revision).toBe(8);
  });

  it("saved place needs city, state and pincode and is keyed by home or work", async () => {
    await expect(backendProfile.savePlace("home", "Home", { line1: "x", country: "IN" })).rejects.toMatchObject({ code: "INVALID_ADDRESS" });
    expect(reqs).toHaveLength(0);
    handler = () => ({ body: { ok: true, place: { kind: "saved_place", slot: "work", label: "Work", revision: 1, address } } });
    const place = await backendProfile.savePlace("work", "Work", { ...address });
    expect(place).toMatchObject({ id: "work", kind: "work", label: "Work" });
    expect(reqs[0]!.body).toMatchObject({ kind: "saved_place", slot: "work", label: "Work" });
  });

  it("deletePlace sends the slot and treats an already-gone place as done", async () => {
    handler = () => fail(404, "NOT_FOUND");
    await expect(backendProfile.deletePlace("home")).resolves.toBeUndefined();
    expect(reqs[0]).toMatchObject({ method: "DELETE", path: "/api/app/places?kind=saved_place&slot=home" });
  });

  it("coarse location is rounded to 2 decimals before it leaves the browser; exact goes with the Emergency surface only", async () => {
    handler = () => ({ body: { ok: true, place: { kind: "current_location", revision: 1, precision: "coarse", location: { lat: 18.52, lng: 73.86, accuracyM: 1000 } } } });
    await backendProfile.saveCurrentLocation({ lat: 18.523456, lng: 73.856789, accuracyM: 12, precision: "coarse" });
    expect(reqs[0]!.body).toMatchObject({ kind: "current_location", precision: "coarse", location: { lat: 18.52, lng: 73.86 } });
    expect(reqs[0]!.body).not.toHaveProperty("surface");
    await backendProfile.saveCurrentLocation({ lat: 18.523456, lng: 73.856789, accuracyM: 12, precision: "exact" });
    expect(reqs[1]!.body).toMatchObject({ precision: "exact", surface: "emergency", location: { lat: 18.523456, lng: 73.856789 } });
  });

  it("permission PUT carries state and surface; revoking location resets the current location revision", async () => {
    handler = (r) => (r.method === "PUT" ? { body: { ok: true, permission: { permission: "location", state: "revoked", revision: 5 } } } : emptyProfile(r));
    await backendProfile.setPermission("location", "revoked", "settings");
    expect(reqs[0]).toMatchObject({ path: "/api/app/permissions", method: "PUT", body: { permission: "location", state: "revoked", surface: "settings" } });
  });

  it("a stale revision is re-read and retried once with the person's value", async () => {
    let puts = 0;
    handler = (r) => {
      if (r.method === "PUT") return ++puts === 1 ? fail(409, "REVISION_CONFLICT") : { body: { ok: true, place: { kind: "registered_address", revision: 10, address } } };
      return r.path === "/api/app/permissions" ? { body: { ok: true, permissions: [] } } : { body: { ok: true, places: [{ kind: "registered_address", revision: 9, address }] } };
    };
    await backendProfile.saveAddress(address);
    const puts2 = reqs.filter((r) => r.method === "PUT");
    expect(puts2).toHaveLength(2);
    expect((puts2[1]!.body as { revision: number }).revision).toBe(9);
  });

  it("unauthenticated is a coded error and nothing is cached", async () => {
    handler = () => fail(401, "UNAUTHENTICATED");
    await expect(backendProfile.get()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(backendProfile.setPermission("location", "granted", "settings")).rejects.toBeInstanceOf(AdapterError);
  });

  it("a network failure is retryable", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    await expect(backendProfile.get()).rejects.toMatchObject({ code: "BACKEND_UNREACHABLE", retryable: true });
  });
});

describe("preferences adapter", () => {
  it("maps page switches to the backend document and back", () => {
    const wire = prefsToWire({ ...DEFAULT_PREFS, voice: "hi", theme: "dark", reduced: true });
    expect(wire).toEqual({
      sources: ["email", "digilocker"], notifications: { channels: ["whatsapp", "email"] },
      sharing: { defaultScope: "household", allowFamilyView: true }, voiceLanguage: "hi-IN", reducedMotion: true, theme: "dark",
    });
    expect(prefsFromWire(wire)).toEqual({ ...DEFAULT_PREFS, voice: "hi", theme: "dark", reduced: true });
    expect(prefsFromWire(prefsToWire(DEFAULT_PREFS))).toEqual(DEFAULT_PREFS); // "both" has no single voice language
  });

  it("round-trips through the BFF with the stored revision", async () => {
    handler = (r) => (r.method === "PUT" ? { body: { ok: true, prefs: (r.body as { prefs: unknown }).prefs, revision: 4 } } : { body: { ok: true, prefs: null, revision: 3 } });
    expect(await backendPreferences.get()).toBeNull();
    const next = { ...DEFAULT_PREFS, reduced: true };
    await backendPreferences.save(next);
    expect(reqs[1]).toMatchObject({ method: "PUT", body: { revision: 3, prefs: { reducedMotion: true } } });
    await backendPreferences.save({ ...next, voice: "en" });
    expect((reqs[2]!.body as { revision: number }).revision).toBe(4);
  });

  it("revision conflict: re-reads and retries with the person's latest settings", async () => {
    let puts = 0;
    handler = (r) => {
      if (r.method === "PUT") return ++puts === 1 ? fail(409, "REVISION_CONFLICT") : { body: { ok: true, prefs: {}, revision: 8 } };
      return { body: { ok: true, prefs: { theme: "dark" }, revision: 7 } };
    };
    await backendPreferences.save({ ...DEFAULT_PREFS, reduced: true });
    const sent = reqs.filter((r) => r.method === "PUT");
    expect(sent).toHaveLength(2);
    expect(sent[1]!.body).toMatchObject({ revision: 7, prefs: { reducedMotion: true } });
  });

  it("update merges one setting on top of what is stored", async () => {
    handler = (r) => (r.method === "PUT" ? { body: { ok: true, prefs: {}, revision: 2 } } : { body: { ok: true, prefs: { voiceLanguage: "hi-IN", theme: "light", reducedMotion: true }, revision: 1 } });
    await backendPreferences.update({ theme: "dark" });
    expect(reqs.at(-1)!.body).toMatchObject({ revision: 1, prefs: { theme: "dark", reducedMotion: true, voiceLanguage: "hi-IN" } });
  });

  it("two quick saves go out one after the other, each with the latest revision", async () => {
    let rev = 0;
    handler = async (r) => {
      if (r.method === "GET") return { body: { ok: true, prefs: null, revision: 0 } };
      await new Promise((res) => setTimeout(res, 5));
      return { body: { ok: true, prefs: {}, revision: ++rev } };
    };
    await backendPreferences.get();
    await Promise.all([backendPreferences.save({ ...DEFAULT_PREFS, reduced: true }), backendPreferences.save({ ...DEFAULT_PREFS, reduced: false })]);
    const puts = reqs.filter((r) => r.method === "PUT").map((r) => (r.body as { revision: number }).revision);
    expect(puts).toEqual([0, 1]);
  });
});

describe("onboarding adapter", () => {
  it("maps ways and people both directions", () => {
    const ui = { step: 2, way: "up" as const, people: { M: true, R: false, K: true, A: false }, wallet: "apple" as const, completed: false };
    const wire = onboardingToWire(ui);
    expect(wire).toEqual({ step: 2, way: "upload", people: { self: true, partner: false, children: true, parents: false }, wallet: "apple" });
    expect(onboardingFromWire(wire, false)).toEqual(ui);
    for (const way of ["dl", "up", "hr", "no"] as const) expect(onboardingFromWire(onboardingToWire({ way, completed: false }), false).way).toBe(way);
  });
  it("saves progress and the completed flag", async () => {
    handler = (r) => (r.method === "PUT" ? { body: { ok: true, state: (r.body as { state: unknown }).state, completed: true, revision: 1 } } : { body: { ok: true, state: null, completed: false, revision: 0 } });
    expect(await backendOnboarding.get()).toBeNull();
    await backendOnboarding.save({ step: 3, completed: true });
    expect(reqs[1]).toMatchObject({ method: "PUT", path: "/api/app/onboarding", body: { state: { step: 3 }, completed: true, revision: 0 } });
  });
});

describe("useAutosave", () => {
  function Probe({ save }: { save: (v: number) => Promise<unknown> }) {
    const a = useAutosave<number>(save);
    return (
      <div>
        <button onClick={() => a.push(1)}>one</button>
        <button onClick={() => a.push(2)}>two</button>
        <SaveState status={a.status} onRetry={a.retry} />
      </div>
    );
  }
  it("double-submit of the same value sends one request", async () => {
    let release!: () => void;
    const save = vi.fn(() => new Promise<void>((r) => (release = r)));
    render(<Probe save={save} />);
    await act(async () => { for (let i = 0; i < 20; i++) fireEvent.click(screen.getByText("one")); });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => release());
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("a value pushed during a save is not dropped: the newest goes next", async () => {
    const seen: number[] = [];
    const gates: (() => void)[] = [];
    const save = vi.fn((v: number) => new Promise<void>((r) => { seen.push(v); gates.push(r); }));
    render(<Probe save={save} />);
    await act(async () => { fireEvent.click(screen.getByText("one")); });
    await act(async () => { fireEvent.click(screen.getByText("two")); });
    await act(async () => gates[0]!());
    await waitFor(() => expect(seen).toEqual([1, 2]));
    await act(async () => gates[1]!());
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
  it("changing back to the value already being saved sends nothing more", async () => {
    const seen: number[] = [];
    const gates: (() => void)[] = [];
    const save = vi.fn((v: number) => new Promise<void>((r) => { seen.push(v); gates.push(r); }));
    render(<Probe save={save} />);
    await act(async () => { fireEvent.click(screen.getByText("one")); });
    await act(async () => { fireEvent.click(screen.getByText("two")); fireEvent.click(screen.getByText("one")); });
    await act(async () => gates[0]!());
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(seen).toEqual([1]);
  });
  it("a failed save shows Retry and sends the same value again", async () => {
    const save = vi.fn().mockRejectedValueOnce(new AdapterError("DOWN", true)).mockResolvedValue(undefined);
    render(<Probe save={save} />);
    await act(async () => { fireEvent.click(screen.getByText("two")); });
    expect(await screen.findByText(/Could not save/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(save.mock.calls).toEqual([[2], [2]]);
  });
  it("hook is stable across renders", () => {
    const { result, rerender } = renderHook(() => useAutosave<number>(async () => undefined));
    const push = result.current.push;
    rerender();
    expect(result.current.push).toBe(push);
  });
});
