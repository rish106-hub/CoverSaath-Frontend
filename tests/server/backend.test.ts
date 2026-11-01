import { describe, expect, it } from "vitest";
import { createBackendClient } from "@/server/backend/client";
import { AppError } from "@/server/backend/errors";
import { missingEnv } from "@/server/backend/env";
import { open, seal } from "@/server/backend/session";
import { grantAccess, readMe } from "@/server/backend/service";

const SECRET = "x".repeat(40);
const payload = { t: "tok-1234567890abcdef", h: "h1", m: "m1", exp: Date.now() + 60_000 };

const fake = (routes: Record<string, { status: number; body: unknown }>) =>
  createBackendClient({
    baseUrl: "http://backend.test",
    bootstrapToken: "boot",
    fetch: async (url) => {
      const path = new URL(url).pathname;
      const r = routes[path] ?? { status: 404, body: {} };
      return new Response(JSON.stringify(r.body), { status: r.status });
    },
  });

describe("sealed session", () => {
  it("round-trips and rejects tampering, wrong key and expiry", () => {
    const s = seal(payload, SECRET);
    expect(open(s, SECRET)).toEqual(payload);
    const [iv, tag, enc] = s.split(".");
    const flipped = [iv, (tag[0] === "A" ? "B" : "A") + tag.slice(1), enc].join(".");
    expect(open(flipped, SECRET)).toBeNull();
    expect(open(s, "y".repeat(40))).toBeNull();
    expect(open(seal({ ...payload, exp: Date.now() - 1 }, SECRET), SECRET)).toBeNull();
    expect(s).not.toContain(payload.t);
  });
});

describe("backend client", () => {
  const created = { household: { id: "h1", display_name: "Rao family" }, owner: { id: "a1", display_name: "Meera Rao" }, ownerMember: { id: "m1" }, session: { token: "t".repeat(40), sessionId: "s1", adultUserId: "a1", expiresAt: new Date(Date.now() + 3.6e6).toISOString() } };
  const matrix = { household: { id: "h1", display_name: "Rao family" }, viewerRole: "owner", members: [{ id: "m1", displayName: "Meera Rao" }] };

  it("creates the household and reads the owner back from the backend response", async () => {
    const c = fake({ "/api/v1/households": { status: 201, body: created }, "/api/v1/households/h1": { status: 200, body: matrix } });
    const { session, firstName } = await grantAccess(c, { name: "Meera Rao", email: "meera.rao@company.com" });
    expect(firstName).toBe("Meera");
    const me = await readMe(c, session);
    expect(me.owner.displayName).toBe("Meera Rao");
    expect(me.householdName).toBe("Rao family");
  });
  it("rejects bad input before calling the backend", async () => {
    await expect(grantAccess(fake({}), { name: "", email: "nope" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("maps a dead backend to a retryable coded error", async () => {
    const dead = createBackendClient({ baseUrl: "http://x", bootstrapToken: "b", fetch: async () => { throw new Error("ECONNREFUSED"); } });
    await expect(dead.health()).rejects.toMatchObject({ code: "BACKEND_UNREACHABLE", retryable: true });
  });
  it("times out", async () => {
    const slow = createBackendClient({ baseUrl: "http://x", bootstrapToken: "b", timeoutMs: 20, fetch: (_u, i) => new Promise((_r, rej) => i?.signal?.addEventListener("abort", () => rej(new Error("aborted")))) });
    await expect(slow.health()).rejects.toMatchObject({ code: "BACKEND_TIMEOUT" });
  });
  it("401 on an authenticated call is UNAUTHENTICATED", async () => {
    const c = fake({ "/api/v1/households/h1": { status: 401, body: { error: "x" } } });
    await expect(c.household("t", "h1")).rejects.toBeInstanceOf(AppError);
    await expect(c.household("t", "h1")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("names the missing env without values", () => {
    expect(missingEnv({} as NodeJS.ProcessEnv)).toEqual(["KNOWVIA_API_URL", "KNOWVIA_BOOTSTRAP_TOKEN", "SESSION_COOKIE_SECRET"]);
  });
});
