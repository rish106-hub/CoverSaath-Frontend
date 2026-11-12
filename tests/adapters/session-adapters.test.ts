import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAdapters } from "@/adapters";
import { mockAdapters } from "@/adapters/mock";
import { realAdapters } from "@/adapters/real";
import { resetSessionMode } from "@/adapters/session-mode";

const ME = (source: "backend" | "demo") => ({
  householdId: source === "demo" ? "demo" : "h1",
  householdName: source === "demo" ? "Rao household" : "Real household",
  owner: { id: source === "demo" ? "meera" : "m1", displayName: source === "demo" ? "Meera Rao" : "Asha Verma" },
  source,
});

function stubSession(source: "backend" | "demo" | null) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes("/api/app/me")) {
      return source ? Response.json(ME(source)) : Response.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (u.includes("/api/app/covers/holdings")) return Response.json({ ok: true, data: { holdings: [] } });
    return Response.json({ ok: false }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const MOCK_NAMES = /Meera|Rohan|Kabir|Northstar|Rao household/i;

beforeEach(() => resetSessionMode());
afterEach(() => vi.unstubAllGlobals());

describe("per-session adapters", () => {
  it("a real session never receives mock data from any data adapter", async () => {
    const fetchMock = stubSession("backend");
    const a = buildAdapters(mockAdapters, realAdapters);
    const out = {
      household: await a.household.household(),
      documents: await a.document.list(),
      policies: await a.policy.list(),
      policy: await a.policy.get("northstar-floater"),
      findings: await a.reading.findings("northstar-floater"),
      email: await a.email.scan(),
      cases: await a.desk.cases(),
      board: await a.desk.board(),
      nearby: await a.hospital.nearby(),
      ranked: await a.hospital.ranked("accident", "cashless"),
      stock: await a.blood.stock(),
      groups: await a.blood.groups(),
      banks: await a.blood.banks("O+"),
      posts: await a.learn.posts(),
    };
    expect(out.policies).toEqual([]);
    expect(out.policy).toBeNull();
    expect(out.documents).toEqual([]);
    expect(out.findings).toEqual([]);
    expect(out.email).toEqual({ found: 0, items: [] });
    expect(out.cases).toEqual([]);
    expect(out.board).toEqual([]);
    expect(out.nearby).toEqual([]);
    expect(out.ranked).toEqual([]);
    expect(out.stock).toEqual([]);
    expect(out.groups).toEqual({});
    expect(out.banks).toEqual([]);
    expect(out.posts).toEqual([]);
    expect(out.household.members.map((m) => m.name)).toEqual(["Asha Verma"]);
    expect(JSON.stringify(out)).not.toMatch(MOCK_NAMES);
    // Chat is the backend's, never the mock's canned replies: a real session's question goes to the BFF chat route.
    await a.assistant.ask("which policy covers my father?", "/home").catch(() => undefined);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/app/chat"))).toBe(true);
    await expect(a.invite.invite({ relation: "x", name: "x", mobile: "9999999999", via: "sms" })).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    await expect(a.wallet.pass("apple")).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
  });

  it("a real session does not get mock data when the session lookup fails or is signed out", async () => {
    stubSession(null);
    const a = buildAdapters(mockAdapters, realAdapters);
    expect(await a.policy.list()).toEqual([]);
    resetSessionMode();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    // Real policies come from the backend: when it cannot be reached the call fails with a code, it never falls back to mock policies.
    await expect(a.policy.list()).rejects.toMatchObject({ code: "BACKEND_UNREACHABLE" });
    expect(await a.desk.board()).toEqual([]);
  });

  it("the demo session gets the mock set", async () => {
    stubSession("demo");
    const a = buildAdapters(mockAdapters, realAdapters);
    const policies = await a.policy.list();
    expect(policies.length).toBeGreaterThan(0);
    const h = await a.household.household();
    expect(h.members.length).toBeGreaterThan(1);
    expect(JSON.stringify(h)).toMatch(/Meera/);
  });

  it("switches with the session: sign in as demo, sign out, sign in as a real user", async () => {
    stubSession("demo");
    const a = buildAdapters(mockAdapters, realAdapters);
    expect((await a.policy.list()).length).toBeGreaterThan(0);
    resetSessionMode();
    stubSession("backend");
    expect(await a.policy.list()).toEqual([]);
  });

  it("the real set never reuses mock collections by reference", () => {
    for (const k of ["document", "policy", "reading", "desk", "hospital", "blood", "learn", "email"] as const) {
      expect(realAdapters[k]).not.toBe(mockAdapters[k]);
    }
  });
});
