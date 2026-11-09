// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Force backend mode so adapters/index.ts builds its demo Proxy, then check a demo session never reaches the BFF for chat or voice.
vi.mock("@/adapters/mode", () => ({ useBackend: true }));

const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true, reply: "from backend", steps: [] }), { status: 200 }));
beforeEach(() => { fetchSpy.mockClear(); vi.stubGlobal("fetch", fetchSpy); });
afterEach(() => { vi.unstubAllGlobals(); document.cookie = "kv_demo=; Max-Age=0; path=/"; });

describe("adapters: demo sessions", () => {
  it("route assistant and voice to the mock and never call the BFF", async () => {
    document.cookie = "kv_demo=1; path=/";
    const { adapters } = await import("@/adapters");
    const { mockAdapters } = await import("@/adapters/mock");
    const r = await adapters.assistant.ask("Take me home", "/home");
    expect(typeof r.reply).toBe("string");
    expect(fetchSpy).not.toHaveBeenCalled();
    // the voice proxy resolves to the mock voice (browser speech): same support answer, no capture started
    expect(adapters.voice.supported()).toBe(mockAdapters.voice.supported());
    expect(adapters.voice.notice).toBe(mockAdapters.voice.notice);
  });
  it("a non-demo session gets the backend assistant (BFF call)", async () => {
    const { adapters } = await import("@/adapters");
    await adapters.assistant.ask("hello", "/home").catch(() => undefined);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0] as unknown as [string])[0]).toBe("/api/app/chat");
  });
});
