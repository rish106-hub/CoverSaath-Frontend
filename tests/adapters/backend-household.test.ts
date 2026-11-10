import { afterEach, describe, expect, it, vi } from "vitest";
import { backendHousehold } from "@/adapters/backend";
import { householdSchema } from "@/adapters/schemas";

const me = { householdId: "h1", householdName: "Kulkarni family", owner: { id: "m1", displayName: "Asha Kulkarni" }, source: "backend" };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const stub = (routes: Record<string, () => Response>) =>
  vi.stubGlobal("fetch", async (url: string) => {
    const r = routes[String(url).split("?")[0]];
    return r ? r() : reply(404, { code: "NOT_FOUND" });
  });

afterEach(() => vi.unstubAllGlobals());

describe("backend household: only what the backend returns", () => {
  it("lists the owner and the stored members, never the mock family", async () => {
    stub({
      "/api/app/me": () => reply(200, me),
      "/api/app/members": () => reply(200, { members: [
        { id: "m1", displayName: "Asha Kulkarni", relationshipLabel: null, ageYears: null, isOwner: true, isYou: true },
        { id: "m2", displayName: "Dev", relationshipLabel: "Son", ageYears: 9, isOwner: false, isYou: false },
        { id: "m3", displayName: "Nila", relationshipLabel: "Aunt", ageYears: null, isOwner: false, isYou: false },
      ] }),
    });
    const h = householdSchema.parse(await backendHousehold.household());
    expect(h.id).toBe("h1");
    expect(h.displayName).toBe("Kulkarni family");
    expect(h.members.map((m) => [m.id, m.name, m.relation])).toEqual([["m1", "Asha Kulkarni", "self"], ["m2", "Dev", "child"], ["m3", "Nila", "other"]]);
    expect(JSON.stringify(h)).not.toMatch(/Rao|Meera|Rohan|Kabir|mock-household/);
  });

  it("falls back to the owner alone when the member list cannot be read", async () => {
    stub({ "/api/app/me": () => reply(200, me), "/api/app/members": () => reply(503, { code: "BACKEND_UNREACHABLE" }) });
    const h = await backendHousehold.household();
    expect(h.members).toEqual([{ id: "m1", name: "Asha Kulkarni", relation: "self", age: 0, invite: "joined" }]);
  });

  it("signed out: an empty household, not the mock family", async () => {
    stub({ "/api/app/me": () => reply(401, { code: "UNAUTHENTICATED" }) });
    expect((await backendHousehold.household()).members).toEqual([]);
  });
});
