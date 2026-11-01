// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { adapters } from "@/adapters";
import { backendOnboarding, backendPreferences, backendProfile, DEFAULT_PREFS, prefsToWire, resetUserDataCache } from "@/adapters/user-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/settings" }));

import { SettingsView } from "@/components/help/SettingsView";
import { EmergencyView } from "@/components/help/EmergencyView";
import { OnboardingFlow } from "@/components/onboarding/Flow";
import { ThemeProvider } from "@/components/theme";

type Req = { path: string; method: string; body: unknown };
let reqs: Req[];
let prefsStore: { prefs: unknown; revision: number };
let obStore: { state: unknown; completed: boolean; revision: number };
let failPut: number; // number of PUTs to preferences that fail
const original = { ...adapters };

beforeEach(() => {
  reqs = [];
  prefsStore = { prefs: null, revision: 0 };
  failPut = 0;
  obStore = { state: null, completed: false, revision: 0 };
  resetUserDataCache();
  Object.assign(adapters, { preferences: backendPreferences, profile: backendProfile, onboarding: backendOnboarding });
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    reqs.push({ path, method, body });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (path === "/api/app/preferences") {
      if (method === "PUT") {
        if (failPut > 0) { failPut--; return new Response(JSON.stringify({ ok: false, code: "BACKEND_UNREACHABLE", retryable: true }), { status: 502 }); }
        prefsStore = { prefs: body.prefs, revision: prefsStore.revision + 1 };
      }
      return ok({ ok: true, ...prefsStore });
    }
    if (path === "/api/app/permissions") return method === "PUT" ? ok({ ok: true, permission: { permission: body.permission, state: body.state, revision: 1 } }) : ok({ ok: true, permissions: [] });
    if (path === "/api/app/places") return method === "PUT" ? ok({ ok: true, place: { kind: "current_location", revision: 1, precision: body.precision, location: body.location } }) : ok({ ok: true, places: [] });
    if (path === "/api/app/onboarding") {
      if (method === "PUT") obStore = { state: body.state, completed: !!body.completed, revision: obStore.revision + 1 };
      return ok({ ok: true, ...obStore });
    }
    return new Response("{}", { status: 404 });
  });
});
afterEach(() => {
  cleanup();
  Object.assign(adapters, original);
  vi.unstubAllGlobals();
});

const settings = () => render(<ThemeProvider><SettingsView logos={{ digilocker: null, abha: null }} /></ThemeProvider>);
const puts = (path: string) => reqs.filter((r) => r.path === path && r.method === "PUT");

describe("Settings over the backend", () => {
  it("loads stored settings on mount", async () => {
    prefsStore = { prefs: prefsToWire({ ...DEFAULT_PREFS, reduced: true, voice: "hi" }), revision: 2 };
    settings();
    const motion = await screen.findByRole("switch", { name: "Reduce motion" });
    await waitFor(() => expect(motion).toHaveAttribute("aria-checked", "true"));
    expect(screen.getByRole("button", { name: "हिंदी" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a switch saves through the BFF and shows Saved", async () => {
    settings();
    const motion = await screen.findByRole("switch", { name: "Reduce motion" });
    await waitFor(() => expect(motion).not.toBeDisabled());
    fireEvent.click(motion);
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(puts("/api/app/preferences")[0]!.body).toMatchObject({ revision: 0, prefs: { reducedMotion: true } });
  });

  it("a failed save keeps the choice and Retry sends it again", async () => {
    settings();
    const motion = await screen.findByRole("switch", { name: "Reduce motion" });
    await waitFor(() => expect(motion).not.toBeDisabled());
    failPut = 1;
    fireEvent.click(motion);
    expect(await screen.findByText(/Could not save/)).toBeInTheDocument();
    expect(motion).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect((prefsStore.prefs as { reducedMotion: boolean }).reducedMotion).toBe(true);
  });

  it("20 clicks on one switch in the same tick send one request", async () => {
    settings();
    const motion = await screen.findByRole("switch", { name: "Reduce motion" });
    await waitFor(() => expect(motion).not.toBeDisabled());
    await act(async () => { for (let i = 0; i < 20; i++) fireEvent.click(motion); });
    await screen.findByText("Saved");
    expect(puts("/api/app/preferences").length).toBeLessThanOrEqual(2);
  });

  it("turning notifications on or off records the device permission", async () => {
    settings();
    const email = await screen.findByRole("switch", { name: "Email" });
    await waitFor(() => expect(email).not.toBeDisabled());
    fireEvent.click(screen.getByRole("switch", { name: "WhatsApp" }));
    fireEvent.click(email);
    await waitFor(() => expect(puts("/api/app/permissions")).toHaveLength(1));
    expect(puts("/api/app/permissions")[0]!.body).toMatchObject({ permission: "notifications", state: "revoked", surface: "settings" });
  });

  it("controls stay locked, with Retry, when the settings cannot be loaded", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, code: "UNAUTHENTICATED", retryable: false }), { status: 401 }));
    settings();
    expect(await screen.findByText(/Could not load your settings/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Reduce motion" })).toBeDisabled();
  });
});

describe("Emergency location", () => {
  const geo = (impl: (ok: (p: unknown) => void, err: (e: { code: number }) => void) => void) =>
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: impl } });

  it("Allow location records the permission and the exact position from the Emergency surface", async () => {
    geo((ok) => ok({ coords: { latitude: 18.523456, longitude: 73.856789, accuracy: 12.4 } }));
    render(<EmergencyView />);
    fireEvent.click(await screen.findByRole("button", { name: "Allow location" }));
    await waitFor(() => expect(puts("/api/app/places")).toHaveLength(1));
    expect(puts("/api/app/permissions")[0]!.body).toMatchObject({ permission: "location", state: "granted", surface: "emergency" });
    expect(puts("/api/app/places")[0]!.body).toMatchObject({ kind: "current_location", precision: "exact", surface: "emergency", location: { lat: 18.523456, lng: 73.856789, accuracyM: 12 } });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("denied in the browser records a denied permission and saves no position", async () => {
    geo((_ok, err) => err({ code: 1 }));
    render(<EmergencyView />);
    fireEvent.click(await screen.findByRole("button", { name: "Allow location" }));
    await waitFor(() => expect(puts("/api/app/permissions")).toHaveLength(1));
    expect(puts("/api/app/permissions")[0]!.body).toMatchObject({ permission: "location", state: "denied" });
    expect(puts("/api/app/places")).toHaveLength(0);
  });

  it("a failed save says so and Retry sends it again", async () => {
    geo((ok) => ok({ coords: { latitude: 18.5, longitude: 73.8, accuracy: 20 } }));
    let n = 0;
    const base = globalThis.fetch;
    vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => (path === "/api/app/permissions" && init?.method === "PUT" && n++ === 0 ? new Response(JSON.stringify({ ok: false, code: "BACKEND_UNREACHABLE", retryable: true }), { status: 502 }) : base(path, init)));
    render(<EmergencyView />);
    fireEvent.click(await screen.findByRole("button", { name: "Allow location" }));
    expect(await screen.findByText(/Could not save/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
});

describe("Onboarding", () => {
  it("saves the step, the way and the people toggles", async () => {
    render(<OnboardingFlow slug="add" />);
    await waitFor(() => expect(puts("/api/app/onboarding")[0]?.body).toMatchObject({ state: { step: 0 } }));
    fireEvent.click(screen.getByRole("radio", { name: /Upload a PDF/ }));
    await waitFor(() => expect(puts("/api/app/onboarding").at(-1)!.body).toMatchObject({ state: { step: 0, way: "upload" }, completed: false }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    cleanup();
    render(<OnboardingFlow slug="people" />);
    const parents = await screen.findByRole("button", { name: /Parents/ });
    await waitFor(() => expect(puts("/api/app/onboarding").at(-1)!.body).toMatchObject({ state: { step: 2, way: "upload" } }));
    fireEvent.click(parents);
    await waitFor(() => expect(puts("/api/app/onboarding").at(-1)!.body).toMatchObject({ state: { people: { parents: true } } }));
    expect(parents).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the stored way and marks the flow complete on the last step", async () => {
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
      reqs.push({ path, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body as string) : undefined });
      return new Response(JSON.stringify(init.method === "PUT" ? { ok: true, state: {}, completed: true, revision: 2 } : { ok: true, state: { step: 1, way: "talk" }, completed: false, revision: 1 }), { status: 200 });
    });
    const add = render(<OnboardingFlow slug="add" />);
    await waitFor(() => expect(screen.getByRole("radio", { name: /Forward the HR mail/ })).toHaveAttribute("aria-checked", "true"));
    add.unmount();
    render(<OnboardingFlow slug="ready" />);
    const go = await screen.findByRole("link", { name: "Go to my home" });
    await waitFor(() => expect(puts("/api/app/onboarding").length).toBeGreaterThan(0));
    fireEvent.click(go);
    await waitFor(() => expect(puts("/api/app/onboarding").at(-1)!.body).toMatchObject({ completed: true }));
  });

  it("a failed save keeps the choice and offers Retry", async () => {
    const base = globalThis.fetch;
    let fail = false;
    vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => (fail && init?.method === "PUT" ? new Response(JSON.stringify({ ok: false, code: "BACKEND_UNREACHABLE", retryable: true }), { status: 502 }) : base(path, init)));
    render(<OnboardingFlow slug="add" />);
    await waitFor(() => expect(puts("/api/app/onboarding")).toHaveLength(1));
    fail = true;
    fireEvent.click(screen.getByRole("radio", { name: /Policy number/ }));
    expect(await screen.findByText(/Could not save/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Policy number/ })).toHaveAttribute("aria-checked", "true");
  });
});
