import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/server/backend/session";

const SECRET = "s".repeat(40);
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined), set: () => {}, delete: () => {} }) }));

import * as permissions from "@/app/api/app/permissions/route";
import * as places from "@/app/api/app/places/route";
import * as prefs from "@/app/api/app/preferences/route";
import * as onboarding from "@/app/api/app/onboarding/route";
import { mapFailure } from "@/server/backend/user-data";

const TOKEN = "test-token";
type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
let calls: Call[];
let reply: { status: number; body: unknown };

const req = (path: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) =>
  new Request(`http://app.test${path}`, {
    method,
    headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "application/json", ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  cookieValue = seal({ t: TOKEN, h: "h1", m: "m1", exp: Date.now() + 60_000 }, SECRET);
  calls = [];
  reply = { status: 200, body: {} };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined });
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
});
afterEach(() => vi.unstubAllGlobals());

const address = { line1: "22, Park Road", city: "Pune", state: "Maharashtra", pincode: "411001", country: "IN" };

describe("session and CSRF", () => {
  it("answers UNAUTHENTICATED without a session and never calls the backend", async () => {
    cookieValue = undefined;
    const res = await permissions.GET(req("/api/app/permissions"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, code: "UNAUTHENTICATED", retryable: false });
    expect(calls).toHaveLength(0);
  });
  it("refuses a write without the app marker header", async () => {
    const r = new Request("http://app.test/api/app/preferences", { method: "PUT", headers: { host: "app.test" }, body: "{}" });
    const res = await prefs.PUT(r);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN_ORIGIN");
    expect(calls).toHaveLength(0);
  });
  it("refuses a foreign origin", async () => {
    const res = await prefs.PUT(req("/api/app/preferences", "PUT", { prefs: {} }, { origin: "http://evil.test" }));
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});

describe("permissions", () => {
  it("round-trips: PUT forwards state, surface and If-Match with the sealed token", async () => {
    reply = { status: 200, body: { permission: "location", state: "granted", surface: "emergency", revision: 4, decidedAt: "x" } };
    const res = await permissions.PUT(req("/api/app/permissions", "PUT", { permission: "location", state: "granted", surface: "emergency", revision: 3 }));
    expect(await res.json()).toEqual({ ok: true, permission: { permission: "location", state: "granted", surface: "emergency", revision: 4 } });
    expect(calls[0]).toMatchObject({ method: "PUT", url: "http://backend.test/api/v1/households/h1/permissions/location", body: { state: "granted", surface: "emergency" } });
    expect(calls[0]!.headers["if-match"]).toBe("3");
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });
  it("GET lists", async () => {
    reply = { status: 200, body: { householdId: "h1", permissions: [{ permission: "notifications", state: "denied", surface: "settings", revision: 1, decidedAt: "x" }] } };
    const j = await (await permissions.GET(req("/api/app/permissions"))).json();
    expect(j.permissions).toEqual([{ permission: "notifications", state: "denied", surface: "settings", revision: 1 }]);
  });
  it("rejects unknown keys and bad enums before the backend", async () => {
    for (const body of [{ permission: "location", state: "granted", surface: "emergency", extra: 1 }, { permission: "wallet", state: "granted", surface: "emergency" }]) {
      const res = await permissions.PUT(req("/api/app/permissions", "PUT", body));
      expect(res.status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  });
});

describe("places", () => {
  it("registered address round-trip, empty optional lines dropped", async () => {
    reply = { status: 200, body: { id: "p1", kind: "registered_address", slot: null, label: null, precision: "exact", source: "user_typed", revision: 1, address } };
    const res = await places.PUT(req("/api/app/places", "PUT", { kind: "registered_address", address: { ...address, line2: "", landmark: "  " }, source: "user_typed" }));
    const j = await res.json();
    expect(j.place.address.city).toBe("Pune");
    expect(calls[0]!.url).toBe("http://backend.test/api/v1/households/h1/places/registered_address");
    expect((calls[0]!.body as { address: Record<string, unknown> }).address).not.toHaveProperty("line2");
    expect(calls[0]!.headers["if-match"]).toBeUndefined();
  });
  it("saved place carries the slot and revision", async () => {
    reply = { status: 200, body: { kind: "saved_place", slot: "home", label: "Home", revision: 2, address } };
    await places.PUT(req("/api/app/places", "PUT", { kind: "saved_place", slot: "home", label: "Home", address, revision: 1 }));
    expect(calls[0]!.body).toMatchObject({ slot: "home", label: "Home" });
    expect(calls[0]!.headers["if-match"]).toBe("1");
  });
  it("coarse location is rounded to 2 decimals in the BFF even if the client did not", async () => {
    reply = { status: 200, body: { kind: "current_location", revision: 1, precision: "coarse", location: { lat: 18.52, lng: 73.86, accuracyM: 1000 } } };
    await places.PUT(req("/api/app/places", "PUT", { kind: "current_location", precision: "coarse", location: { lat: 18.523456, lng: 73.856789, accuracyM: 12 } }));
    expect(calls[0]!.body).toMatchObject({ location: { lat: 18.52, lng: 73.86, accuracyM: 1000 }, precision: "coarse" });
  });
  it("exact location only from the Emergency surface", async () => {
    const body = { kind: "current_location", precision: "exact", location: { lat: 18.523456, lng: 73.856789, accuracyM: 12 } };
    expect((await places.PUT(req("/api/app/places", "PUT", body))).status).toBe(400);
    expect((await places.PUT(req("/api/app/places", "PUT", { ...body, surface: "settings" }))).status).toBe(400);
    expect(calls).toHaveLength(0);
    reply = { status: 200, body: { kind: "current_location", revision: 1, location: { lat: 18.523456, lng: 73.856789 } } };
    const ok = await places.PUT(req("/api/app/places", "PUT", { ...body, surface: "emergency" }));
    expect(ok.status).toBe(200);
    expect(calls[0]!.body).toMatchObject({ location: { lat: 18.523456, lng: 73.856789 }, surface: "emergency" });
  });
  it("DELETE maps kind, slot and revision", async () => {
    reply = { status: 200, body: { status: "removed", kind: "saved_place" } };
    const res = await places.DELETE(req("/api/app/places?kind=saved_place&slot=work&revision=2", "DELETE"));
    expect(await res.json()).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "http://backend.test/api/v1/households/h1/places/saved_place?slot=work" });
    expect(calls[0]!.headers["if-match"]).toBe("2");
    expect((await places.DELETE(req("/api/app/places?kind=saved_place", "DELETE"))).status).toBe(400);
  });
  it("GET lists places without leaking unknown fields", async () => {
    reply = { status: 200, body: { places: [{ id: "p9", kind: "saved_place", memberId: "m1", slot: "home", label: "Home", revision: 1, address, capturedAt: "t" }] } };
    const j = await (await places.GET(req("/api/app/places"))).json();
    expect(j.places[0]).not.toHaveProperty("id");
    expect(j.places[0]).not.toHaveProperty("memberId");
  });
});

describe("preferences and onboarding", () => {
  it("preferences round-trip with If-Match", async () => {
    reply = { status: 200, body: { householdId: "h1", prefs: { theme: "dark", reducedMotion: true }, revision: 5, schemaVersion: 1 } };
    const res = await prefs.PUT(req("/api/app/preferences", "PUT", { prefs: { theme: "dark", reducedMotion: true }, revision: 4 }));
    expect(await res.json()).toEqual({ ok: true, prefs: { theme: "dark", reducedMotion: true }, revision: 5 });
    expect(calls[0]!.body).toEqual({ prefs: { theme: "dark", reducedMotion: true } });
    expect(calls[0]!.headers["if-match"]).toBe("4");
  });
  it("preferences GET with nothing stored", async () => {
    reply = { status: 200, body: { householdId: "h1", prefs: null, revision: 0 } };
    expect(await (await prefs.GET(req("/api/app/preferences"))).json()).toEqual({ ok: true, prefs: null, revision: 0 });
  });
  it("onboarding round-trip turns completedAt into a flag", async () => {
    reply = { status: 200, body: { state: { step: 2, way: "connect", people: { self: true } }, completedAt: "2026-11-01T00:00:00Z", revision: 3 } };
    const res = await onboarding.PUT(req("/api/app/onboarding", "PUT", { state: { step: 2, way: "connect", people: { self: true } }, completed: true }));
    expect(await res.json()).toEqual({ ok: true, state: { step: 2, way: "connect", people: { self: true } }, completed: true, revision: 3 });
    expect(calls[0]!.body).toEqual({ state: { step: 2, way: "connect", people: { self: true } }, completed: true });
  });
  it("rejects oversize or unknown onboarding input", async () => {
    expect((await onboarding.PUT(req("/api/app/onboarding", "PUT", { state: { step: 99 } }))).status).toBe(400);
    expect((await onboarding.PUT(req("/api/app/onboarding", "PUT", { state: { note: "x" } }))).status).toBe(400);
  });
});

describe("error mapping", () => {
  it("maps a stale revision to a coded 409", async () => {
    reply = { status: 409, body: { error: { code: "REVISION_CONFLICT", message: "secret message with Meera Rao" } } };
    const res = await prefs.PUT(req("/api/app/preferences", "PUT", { prefs: {}, revision: 1 }));
    expect(res.status).toBe(409);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, code: "REVISION_CONFLICT", retryable: false });
    expect(text).not.toContain("Meera");
  });
  it("maps the backend codes the contract defines", () => {
    expect(mapFailure(403, { error: { code: "LOCATION_PERMISSION_REQUIRED" } }).code).toBe("LOCATION_PERMISSION_REQUIRED");
    expect(mapFailure(429, { error: { code: "USER_DATA_RATE_LIMITED" } })).toMatchObject({ code: "RATE_LIMITED", retryable: true });
    expect(mapFailure(403, { error: { code: "HOUSEHOLD_WRITE_FORBIDDEN" } }).code).toBe("FORBIDDEN");
    expect(mapFailure(401, null).code).toBe("UNAUTHENTICATED");
    expect(mapFailure(500, null)).toMatchObject({ code: "BACKEND_UNREACHABLE", retryable: true });
  });
  it("a dead backend is a retryable coded error", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("ECONNREFUSED"); });
    const res = await prefs.GET(req("/api/app/preferences"));
    expect(await res.json()).toEqual({ ok: false, code: "BACKEND_UNREACHABLE", retryable: true });
  });
  it("a malformed backend answer is BACKEND_BAD_RESPONSE", async () => {
    reply = { status: 200, body: { prefs: { theme: "neon" }, revision: 1 } };
    expect((await (await prefs.GET(req("/api/app/preferences"))).json()).code).toBe("BACKEND_BAD_RESPONSE");
  });
});
