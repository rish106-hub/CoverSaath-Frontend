import { describe, expect, it } from "vitest";
import type { BackendClient } from "@/server/backend/client";
import { checkDemoLogin, demoCredentials, demoEnabled, isDemoEmail } from "@/server/backend/demo";
import { open, seal } from "@/server/backend/session";
import { grantAccess, readMe } from "@/server/backend/service";

const SECRET = "x".repeat(40);

/** A backend that fails the test if anything touches it. */
const forbidden = new Proxy({}, { get: () => () => { throw new Error("backend must not be called"); } }) as unknown as BackendClient;

/** A backend that records household creation. */
function recording() {
  const calls: unknown[] = [];
  const client = {
    createHousehold: async (input: unknown) => {
      calls.push(input);
      return { token: "t".repeat(40), householdId: "h1", ownerMemberId: "m1", expiresAt: new Date(Date.now() + 3.6e6).toISOString() };
    },
  } as unknown as BackendClient;
  return { client, calls };
}

describe("demo login", () => {
  it("accepts only demo@demo.com / demo123, case-insensitive on email", () => {
    expect(checkDemoLogin("demo@demo.com", "demo123")).toBe(true);
    expect(checkDemoLogin("  Demo@Demo.com ", "demo123")).toBe(true);
    expect(checkDemoLogin("demo@demo.com", "demo124")).toBe(false);
    expect(checkDemoLogin("demo@demo.com", "")).toBe(false);
    expect(checkDemoLogin("demo@demo.com", undefined)).toBe(false);
    expect(checkDemoLogin("other@demo.com", "demo123")).toBe(false);
  });
  it("has one fixed credential, no env override", () => {
    expect(demoCredentials()).toEqual({ email: "demo@demo.com", password: "demo123" });
    expect(isDemoEmail(" Demo@Demo.com ")).toBe(true);
    expect(isDemoEmail("show@example.com")).toBe(false);
  });
  it("is on by default and off only when DEMO_LOGIN_ENABLED=false", () => {
    expect(demoEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(demoEnabled({ DEMO_LOGIN_ENABLED: "true" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(demoEnabled({ DEMO_LOGIN_ENABLED: "false" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("grantAccess with the demo email", () => {
  it("creates a sealed demo session and never calls the backend", async () => {
    const { session, firstName } = await grantAccess(forbidden, { name: "Anyone", email: "demo@demo.com", password: "demo123" });
    expect(session.demo).toBe(true);
    expect(session.t).toBe("");
    expect(firstName).toBe("Meera");
    expect(open(seal(session, SECRET), SECRET)?.demo).toBe(true);
  });
  it("rejects a wrong password with INVALID_CREDENTIALS and never calls the backend", async () => {
    await expect(grantAccess(forbidden, { name: "x", email: "demo@demo.com", password: "wrong" })).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
  });
  it("rejects the demo email with no password: it cannot become a real account", async () => {
    await expect(grantAccess(forbidden, { name: "x", email: "demo@demo.com" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(grantAccess(forbidden, { name: "x", email: "DEMO@demo.com", password: "" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("answers me() from the demo session without the backend", async () => {
    const { session } = await grantAccess(forbidden, { name: "x", email: "demo@demo.com", password: "demo123" });
    const me = await readMe(forbidden, session);
    expect(me.source).toBe("mock");
  });
});

describe("grantAccess for every other email", () => {
  it("goes to the real backend, is not demo, and ignores a password", async () => {
    const { client, calls } = recording();
    const { session } = await grantAccess(client, { name: "Real Person", email: "real@person.in", password: "demo123" });
    expect(session.demo).toBeUndefined();
    expect(session.t).not.toBe("demo");
    expect(calls).toEqual([{ name: "Real Person", email: "real@person.in" }]);
  });
});

describe("session flag", () => {
  it("rejects a malformed demo flag", () => {
    const bad = seal({ t: "a", h: "b", m: "c", exp: Date.now() + 60_000, demo: false as unknown as true }, SECRET);
    expect(open(bad, SECRET)).toBeNull();
  });
});
