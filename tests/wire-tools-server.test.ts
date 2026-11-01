import { describe, expect, it } from "vitest";
import { DataError, createSender, dataFailure, toDataError } from "@/server/backend/data-http";
import { parseRevision, scenarioService } from "@/server/backend/scenarios";
import { memberService } from "@/server/backend/members";
import { compareCodec, inflationCodec, reviewCodec, roomCodec, stressCodec, taxCodec } from "@/lib/scenario-codecs";
import { DEFAULT_WEIGHTS } from "@/lib/fit";
import { NO_LEVERS } from "@/lib/stress";

const session = { t: "tok-1234567890abcdef", h: "h1", m: "m1", exp: Date.now() + 60_000 };

/** A small stand-in for the backend: scenarios with revisions and If-Match, members, and a call log. */
function fakeBackend(opts: { status?: number; body?: unknown } = {}) {
  const scenarios = new Map<string, { inputs: unknown; revision: number }>();
  const members: Record<string, unknown>[] = [];
  const calls: { method: string; path: string; headers: Record<string, string>; body: unknown }[] = [];
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const fetch = async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, path: u.pathname, headers: init?.headers as Record<string, string>, body });
    if (opts.status) return reply(opts.status, opts.body ?? {});
    const sc = u.pathname.match(/\/scenarios\/([a-z_]+)$/);
    if (sc && method === "GET") return reply(200, { householdId: "h1", tool: sc[1], ...(scenarios.get(sc[1]) ?? { inputs: null, revision: 0 }) });
    if (sc && method === "PUT") {
      const cur = scenarios.get(sc[1]) ?? { inputs: null, revision: 0 };
      const m = (init?.headers as Record<string, string>)["if-match"];
      if (m !== undefined && Number(m) !== cur.revision) return reply(409, { error: { code: "REVISION_CONFLICT", message: "secret detail 98765" } });
      const next = { inputs: body.inputs, revision: cur.revision + 1 };
      scenarios.set(sc[1], next);
      return reply(200, { householdId: "h1", tool: sc[1], ...next });
    }
    if (u.pathname.endsWith("/scenarios")) return reply(200, { householdId: "h1", scenarios: [...scenarios].map(([tool, v]) => ({ tool, ...v })) });
    if (u.pathname.endsWith("/members") && method === "GET") return reply(200, { householdId: "h1", members: members });
    if (u.pathname.endsWith("/members") && method === "POST") {
      const m = { id: `m${members.length + 2}`, displayName: body.displayName, memberKind: body.memberKind, relationshipLabel: body.relationshipLabel ?? null, ageYears: null, isOwner: false, isYou: false };
      members.push(m);
      return reply(201, m);
    }
    const one = u.pathname.match(/\/members\/([^/]+)$/);
    if (one && method === "PATCH") {
      const i = members.findIndex((m) => m.id === one[1]);
      if (i < 0) return reply(404, { error: { code: "MEMBER_NOT_FOUND", message: "x" } });
      members[i] = { ...members[i], ...(body.displayName ? { displayName: body.displayName } : {}), ...(body.relationshipLabel !== undefined ? { relationshipLabel: body.relationshipLabel } : {}) };
      return reply(200, members[i]);
    }
    return reply(404, {});
  };
  return { fetch: fetch as never, calls, scenarios };
}
const svc = (b: ReturnType<typeof fakeBackend>) => scenarioService(createSender({ baseUrl: "http://backend.test", fetch: b.fetch }), session);

describe("scenario BFF: every kind round-trips through the allow-lists", () => {
  const cases = [
    ["tax", taxCodec, { regime: "new", self: 6200, par: 38400, senior: false }],
    ["hospital_bill", roomCodec, { cover: 500000, pct: 1.5, room: 8000, other: 120000 }],
    ["inflation", inflationCodec, { who: 1, kase: 2, rate: 14, years: 15 }],
    ["compare_weights", compareCodec, { kind: "base", scen: 2, weights: { ...DEFAULT_WEIGHTS, 3: 3 } }],
    ["stress_levers", stressCodec, { who: "Father", sc: "heart", levers: { top: true, net: false, room: true } }],
    ["review_state", reviewCodec, { st: { dec: { 0: 0, 1: 2 }, ok: { 0: true }, ch: { 1: true } } }],
  ] as const;
  for (const [tool, codec, state] of cases) {
    it(tool, async () => {
      const b = fakeBackend();
      const s = svc(b);
      const saved = await s.put(tool, { inputs: (codec.encode as (v: unknown) => Record<string, unknown>)(state) }, 0);
      expect(saved.revision).toBe(1);
      const got = await s.get(tool);
      expect(got.revision).toBe(1);
      expect((codec.decode as (i: Record<string, unknown>) => unknown)(got.inputs!)).toEqual(state);
      expect((await s.list()).map((x) => x.tool)).toContain(tool);
    });
  }

  it("untouched screens encode to values the backend accepts", async () => {
    const s = svc(fakeBackend());
    await s.put("stress_levers", { inputs: stressCodec.encode({ who: "Meera", sc: "dengue", levers: NO_LEVERS }) }, undefined);
    await s.put("compare_weights", { inputs: compareCodec.encode({ kind: "top", scen: 0, weights: DEFAULT_WEIGHTS }) }, undefined);
  });
});

describe("scenario BFF: guards and errors", () => {
  it("refuses unknown tools, unknown keys and out-of-range numbers before calling the backend", async () => {
    const b = fakeBackend();
    const s = svc(b);
    await expect(s.put("nope", { inputs: {} }, 0)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(s.put("tax", { inputs: { regime: "old", extra: 1 } }, 0)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(s.put("tax", { inputs: { annualIncome: 2e9 } }, 0)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(s.put("tax", { inputs: {}, other: 1 }, 0)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(s.get("nope")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(b.calls).toHaveLength(0);
  });

  it("forwards the revision as If-Match and the token as a bearer header", async () => {
    const b = fakeBackend();
    await svc(b).put("tax", { inputs: { regime: "old" } }, 0);
    expect(b.calls[0]!.headers["if-match"]).toBe("0");
    expect(b.calls[0]!.headers.authorization).toBe(`Bearer ${session.t}`);
    expect(parseRevision("7")).toBe(7);
    expect(parseRevision(null)).toBeUndefined();
    expect(() => parseRevision("abc")).toThrow(DataError);
    expect(() => parseRevision("-1")).toThrow(DataError);
  });

  it("a stale revision is a coded REVISION_CONFLICT with no backend text", async () => {
    const b = fakeBackend();
    const s = svc(b);
    await s.put("tax", { inputs: { regime: "old" } }, 0);
    const err = await s.put("tax", { inputs: { regime: "new" } }, 0).catch((e) => e);
    expect(err).toBeInstanceOf(DataError);
    expect(err).toMatchObject({ status: 409, code: "REVISION_CONFLICT", retryable: true });
    const res = dataFailure(err);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, code: "REVISION_CONFLICT", retryable: true });
    expect(text).not.toContain("secret detail");
  });

  it("unauthenticated and other backend failures are coded", async () => {
    await expect(svc(fakeBackend({ status: 401, body: { error: "x" } })).list()).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(toDataError(500, null)).toMatchObject({ status: 502, code: "BACKEND_UNREACHABLE", retryable: true });
    expect(toDataError(429, { code: "USER_DATA_RATE_LIMITED" })).toMatchObject({ code: "RATE_LIMITED", retryable: true });
    expect(toDataError(413, { code: "PAYLOAD_TOO_LARGE" })).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    const res = dataFailure(new DataError(401, "UNAUTHENTICATED"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, code: "UNAUTHENTICATED", retryable: false });
  });

  it("network failure and timeout are coded and retryable", async () => {
    const down = createSender({ baseUrl: "http://x.test", fetch: async () => { throw new Error("boom 98765"); } });
    await expect(down("GET", "/a", { token: "t" })).rejects.toMatchObject({ code: "BACKEND_UNREACHABLE", retryable: true });
    const slow = createSender({ baseUrl: "http://x.test", timeoutMs: 5, fetch: (_u, init) => new Promise((_r, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted")))) });
    await expect(slow("GET", "/a", { token: "t" })).rejects.toMatchObject({ code: "BACKEND_TIMEOUT", retryable: true });
  });
});

describe("member BFF", () => {
  it("add then edit round-trips name and relation", async () => {
    const b = fakeBackend();
    const m = memberService(createSender({ baseUrl: "http://backend.test", fetch: b.fetch }), session);
    const added = await m.add({ displayName: "Priya Rao", memberKind: "adult", relationshipLabel: "Spouse" });
    expect(added).toMatchObject({ displayName: "Priya Rao", relationshipLabel: "Spouse" });
    const edited = await m.update(added.id, { displayName: "Priya K Rao", relationshipLabel: "Sibling" });
    expect(edited).toMatchObject({ id: added.id, displayName: "Priya K Rao", relationshipLabel: "Sibling" });
    expect((await m.list()).map((x) => x.displayName)).toEqual(["Priya K Rao"]);
  });
  it("validates input and maps a missing member", async () => {
    const b = fakeBackend();
    const m = memberService(createSender({ baseUrl: "http://backend.test", fetch: b.fetch }), session);
    await expect(m.add({ displayName: "", memberKind: "adult" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(m.add({ displayName: "A B", memberKind: "robot" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(m.add({ displayName: "A B", memberKind: "adult", mobile: "9822011223" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(m.update("../x", { displayName: "A B" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(m.update("zzz", {})).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(m.update("zzz", { displayName: "A B" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(b.calls.filter((c) => c.method !== "PATCH")).toHaveLength(0);
  });
});
