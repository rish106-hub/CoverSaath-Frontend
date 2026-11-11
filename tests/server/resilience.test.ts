import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuard } from "@/server/backend/resilience";
import { createBackendClient } from "@/server/backend/client";
import { AppError } from "@/server/backend/errors";
import { failure, retryHeaders } from "@/server/backend";
import { fetchWithRetry, retryDelayMs } from "@/lib/retry-fetch";

const ok = () => new Response("{}", { status: 200 });
const bad = () => new Response("{}", { status: 503 });

describe("backend guard", () => {
  it("fails fast with BACKEND_BUSY when too many calls are in flight, and frees slots after", async () => {
    const guard = createGuard({ maxInflight: 2, retryAfterSeconds: 7 });
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const f = guard.wrap(async () => (await gate, ok()));
    const a = f("u");
    const b = f("u");
    await expect(f("u")).rejects.toMatchObject({ code: "BACKEND_BUSY", status: 503, retryable: true, retryAfter: 7 });
    expect(guard.state().inflight).toBe(2);
    release();
    await Promise.all([a, b]);
    expect(guard.state().inflight).toBe(0);
    await expect(f("u")).resolves.toBeInstanceOf(Response);
  });

  it("opens after consecutive failures, rejects fast, then lets one probe through and closes on success", async () => {
    let t = 1_000;
    let calls = 0;
    let healthy = false;
    const guard = createGuard({ failureThreshold: 3, cooldownMs: 10_000, now: () => t });
    const f = guard.wrap(async () => {
      calls += 1;
      return healthy ? ok() : bad();
    });
    for (let i = 0; i < 3; i += 1) await f("u");
    expect(guard.state().open).toBe(true);
    await expect(f("u")).rejects.toMatchObject({ code: "BACKEND_BUSY" });
    expect(calls).toBe(3); // the open circuit never reached the backend
    t += 10_001;
    healthy = true;
    await expect(f("u")).resolves.toBeInstanceOf(Response); // probe
    expect(guard.state()).toMatchObject({ open: false, consecutiveFailures: 0 });
    await expect(f("u")).resolves.toBeInstanceOf(Response);
  });

  it("counts only network errors, timeouts and 502/503/504; a plain 500 or a 4xx never opens it", async () => {
    let status = 500;
    const guard = createGuard({ failureThreshold: 2 });
    const f = guard.wrap(async () => new Response("{}", { status }));
    for (const s of [500, 500, 500, 400, 401, 404, 429, 500, 500]) {
      status = s;
      await f("u");
    }
    expect(guard.state()).toMatchObject({ open: false, consecutiveFailures: 0 });
    for (const s of [502, 504]) {
      status = s;
      await f("u");
    }
    expect(guard.state().open).toBe(true);
  });

  it("503 opens it, and so do thrown network errors", async () => {
    const a = createGuard({ failureThreshold: 1 });
    await a.wrap(async () => new Response("{}", { status: 503 }))("u");
    expect(a.state().open).toBe(true);
    const b = createGuard({ failureThreshold: 1 });
    await b.wrap(async () => { throw new TypeError("fetch failed"); })("u").catch(() => undefined);
    expect(b.state().open).toBe(true);
  });

  it("a coded HOLDINGS_DISABLED 503 is a flag that is off and never opens it; an uncoded 503 still does", async () => {
    const guard = createGuard({ failureThreshold: 2 });
    const off = guard.wrap(async () => new Response(JSON.stringify({ error: { code: "HOLDINGS_DISABLED" } }), { status: 503 }));
    for (let i = 0; i < 5; i += 1) await off("u");
    expect(guard.state()).toMatchObject({ consecutiveFailures: 0, open: false });
    const down = guard.wrap(async () => new Response(JSON.stringify({ error: { code: "OTHER" } }), { status: 503 }));
    await down("u");
    await down("u");
    expect(guard.state().open).toBe(true);
  });

  it("repeated 500s from the identity sign-in POST cannot open the shared breaker", async () => {
    const guard = createGuard({ failureThreshold: 3 });
    const client = createBackendClient({ baseUrl: "http://api.test", bootstrapToken: "b", identityToken: "i".repeat(40), fetch: guard.wrap(async () => new Response("{}", { status: 500 })) });
    for (let i = 0; i < 10; i += 1) {
      await expect(client.identitySession({ issuer: "https://accounts.google.com", subject: "1", displayName: "A", contactEmail: null })).rejects.toMatchObject({ code: "BACKEND_UNREACHABLE" });
    }
    expect(guard.state().open).toBe(false);
  });

  it("allows only one probe while half-open, and re-opens when the probe fails", async () => {
    let t = 0;
    const guard = createGuard({ failureThreshold: 1, cooldownMs: 1000, now: () => t });
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    let first = true;
    const f = guard.wrap(async () => {
      if (first) {
        first = false;
        return bad();
      }
      await gate;
      return bad();
    });
    await f("u"); // opens
    t += 1001;
    const probe = f("u");
    await expect(f("u")).rejects.toMatchObject({ code: "BACKEND_BUSY" }); // second caller refused while probing
    release();
    await probe;
    expect(guard.state().open).toBe(true); // failed probe re-opens
  });

  it("counts network errors as failures and does not count 4xx", async () => {
    const guard = createGuard({ failureThreshold: 2 });
    const down = guard.wrap(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(down("u")).rejects.toThrow("fetch failed");
    expect(guard.state().consecutiveFailures).toBe(1);
    const four = guard.wrap(async () => new Response("{}", { status: 404 }));
    await four("u");
    expect(guard.state().consecutiveFailures).toBe(0);
  });
});

describe("overload responses", () => {
  it("sends Retry-After and no-store, with a coded body and no internals", async () => {
    const res = failure(new AppError(503, "BACKEND_BUSY", true, 5));
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: false, code: "BACKEND_BUSY", retryable: true });
    expect(retryHeaders({})).toEqual({ "cache-control": "no-store" });
  });
});

describe("fetchWithRetry", () => {
  afterEach(() => vi.unstubAllGlobals());
  const noWait = { sleep: async () => {}, random: () => 0.5 };

  it("retries a GET on 503 and returns the first good answer", async () => {
    const f = vi.fn().mockResolvedValueOnce(bad()).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", f);
    const res = await fetchWithRetry("/x", {}, noWait);
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry budget and returns the last response", async () => {
    const f = vi.fn().mockImplementation(async () => bad());
    vi.stubGlobal("fetch", f);
    const res = await fetchWithRetry("/x", {}, { ...noWait, retries: 2 });
    expect(res.status).toBe(503);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("never retries a write", async () => {
    const f = vi.fn().mockImplementation(async () => bad());
    vi.stubGlobal("fetch", f);
    const res = await fetchWithRetry("/x", { method: "POST" }, noWait);
    expect(res.status).toBe(503);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("does not retry client errors", async () => {
    const f = vi.fn().mockImplementation(async () => new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", f);
    await fetchWithRetry("/x", {}, noWait);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries a network error on GET and rethrows once the budget is spent", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", f);
    await expect(fetchWithRetry("/x", {}, { ...noWait, retries: 1 })).rejects.toThrow("offline");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("honours Retry-After, capped, and backs off with jitter otherwise", () => {
    const o = { baseMs: 400, maxWaitMs: 3000, random: () => 0.5 };
    expect(retryDelayMs(0, "2", o)).toBe(2000);
    expect(retryDelayMs(0, "60", o)).toBe(3000);
    expect(retryDelayMs(0, null, o)).toBe(400);
    expect(retryDelayMs(1, null, o)).toBe(800);
    expect(retryDelayMs(5, "soon", o)).toBe(3000);
  });
});
