import { afterEach, describe, expect, it, vi } from "vitest";
import { backendAssistant, knownRoute, normaliseSteps } from "@/adapters/chat";
import { AdapterError } from "@/adapters/types";
import { respond } from "@/agent/responder";
import { assistantReplySchema } from "@/adapters/schemas";

const reply = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
afterEach(() => vi.unstubAllGlobals());

describe("backendAssistant", () => {
  it("always returns exactly three steps and keeps sources and status", async () => {
    reply(200, { ok: true, reply: "Yes.", steps: ["one"], answerStatus: "evidence_found", sources: [{ tier: "household_evidence", label: "Policy", page: 3, quote: "q" }] });
    const r = await backendAssistant.ask("hi", "/home");
    expect(r.steps).toHaveLength(3);
    expect(r.steps[0]).toBe("one");
    expect(r.answerStatus).toBe("evidence_found");
    expect(r.sources?.[0]?.page).toBe(3);
    expect(normaliseSteps(["a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(normaliseSteps(undefined)).toHaveLength(3);
  });
  it("keeps a known in-app route and drops anything else", async () => {
    reply(200, { reply: "x", route: "/desk", goLabel: "Go" });
    expect((await backendAssistant.ask("x", "/home")).route).toBe("/desk");
    for (const bad of ["https://evil.test", "//evil.test", "/nope", "javascript:alert(1)", "/desk\\x"]) {
      reply(200, { reply: "x", route: bad, goLabel: "Go" });
      const r = await backendAssistant.ask("x", "/home");
      expect(r.route).toBeUndefined();
      expect(r.goLabel).toBeUndefined();
    }
    expect(knownRoute("/policies/abc")).toBe("/policies/abc");
  });
  it("throws coded AdapterErrors", async () => {
    reply(503, { ok: false, code: "CHAT_NOT_CONFIGURED", retryable: false });
    await expect(backendAssistant.ask("x", "/home")).rejects.toMatchObject({ code: "CHAT_NOT_CONFIGURED" });
    reply(200, { nope: 1 });
    await expect(backendAssistant.ask("x", "/home")).rejects.toMatchObject({ code: "BACKEND_BAD_RESPONSE" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    const e = await backendAssistant.ask("x", "/home").catch((x) => x);
    expect(e).toBeInstanceOf(AdapterError);
    expect(e.code).toBe("BACKEND_UNREACHABLE");
  });
  it("posts text and page to the BFF with the app marker", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ reply: "x" }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    await backendAssistant.ask("hello", "/home");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/app/chat");
    expect((init.headers as Record<string, string>)["x-knowvia-app"]).toBe("1");
    expect(JSON.parse(init.body as string)).toEqual({ text: "hello", page: "/home" });
  });
});

describe("mock responder", () => {
  it("carries answerStatus and sources that parse", () => {
    const a = respond("Is cataract covered?", "/assistant");
    expect(assistantReplySchema.safeParse(a).success).toBe(true);
    expect(a.answerStatus).toBeDefined();
    const b = respond("what is the waiting period for dental xyz", "/home");
    expect(assistantReplySchema.safeParse(b).success).toBe(true);
    const found = respond("tell me about cataract cover", "/home");
    expect(["evidence_found", "unknown", "out_of_scope"]).toContain(found.answerStatus);
  });
});
