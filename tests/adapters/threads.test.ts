import { afterEach, describe, expect, it, vi } from "vitest";
import { backendChat } from "@/adapters/threads";
import { TURN_IDLE_MS } from "@/adapters/chat-timing";
import { AdapterError } from "@/adapters/types";
import type { TurnEvent } from "@/adapters/chat-contract";

const frame = (e: string, d: unknown) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
const ANSWER = { turnId: "t1", status: "evidence_found", intent: "x", answer: "Hi", answerSource: "deterministic", factsUsed: [], computed: null, openConflicts: [] };
const stream = (chunks: string[]) => new Response(new ReadableStream<Uint8Array>({ start(c) { for (const k of chunks) c.enqueue(new TextEncoder().encode(k)); c.close(); } }), { status: 200, headers: { "content-type": "text/event-stream" } });
const run = async (res: Response) => {
  vi.stubGlobal("fetch", vi.fn(async () => res));
  const seen: TurnEvent[] = [];
  await backendChat.turn("th-1", { message: "hi" }, (e) => seen.push(e));
  return seen;
};
afterEach(() => vi.unstubAllGlobals());

describe("browser chat client", () => {
  it("reads events across chunk boundaries and stops at done", async () => {
    const all = frame("meta", { threadId: "th-1", intent: "x", retrievalMode: "facts_only" }) + frame("delta", { text: "Hi" }) + frame("answer", ANSWER) + frame("done", {});
    const seen = await run(stream([all.slice(0, 17), all.slice(17, 90), all.slice(90)]));
    expect(seen.map((e) => e.type)).toEqual(["meta", "delta", "answer", "done"]);
  });
  it("sends the turn to its own origin with the app marker and no household id", async () => {
    const f = vi.fn(async () => stream([frame("done", {})]));
    vi.stubGlobal("fetch", f);
    await backendChat.turn("th 1", { message: "hi", inputKind: "voice" }, () => undefined);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/app/chat/threads/th%201/turns");
    expect((init.headers as Record<string, string>)["x-knowvia-app"]).toBe("1");
    expect(JSON.parse(init.body as string)).toEqual({ message: "hi", inputKind: "voice" });
  });
  it("rejects when the stream ends without done, on an error event, and on a malformed frame", async () => {
    await expect(run(stream([frame("delta", { text: "x" })]))).rejects.toMatchObject({ code: "CHAT_STREAM_FAILED" });
    await expect(run(stream([frame("error", { code: "CHAT_STREAM_FAILED" })]))).rejects.toMatchObject({ code: "CHAT_STREAM_FAILED" });
    await expect(run(stream(["event: answer\ndata: {not json}\n\n"]))).rejects.toBeInstanceOf(AdapterError);
    await expect(run(stream([frame("answer", { turnId: "t" })]))).rejects.toMatchObject({ code: "CHAT_STREAM_FAILED" });
  });
  it("turns a JSON failure into its code", async () => {
    await expect(run(new Response(JSON.stringify({ code: "MEMORY_DISABLED", retryable: false }), { status: 503 }))).rejects.toMatchObject({ code: "MEMORY_DISABLED" });
  });
  it("ends quietly when aborted", async () => {
    const ac = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async () => { ac.abort(); throw new DOMException("x", "AbortError"); }));
    await expect(backendChat.turn("th-1", { message: "hi" }, () => undefined, ac.signal)).resolves.toBeUndefined();
  });
});

describe("browser chat go-ahead client", () => {
  it("reads, grants with a request id, and withdraws, all on its own origin", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, consent: true }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    expect(await backendChat.consent()).toBe(true);
    await backendChat.grantConsent("req-12345678");
    await backendChat.revokeConsent();
    const calls = f.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([u, i]) => `${i.method} ${u}`)).toEqual(["GET /api/app/chat/consent", "POST /api/app/chat/consent", "DELETE /api/app/chat/consent"]);
    expect(JSON.parse(calls[1]![1].body as string)).toEqual({ accept: true, requestId: "req-12345678" });
  });
  it("codes a refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, code: "UNAUTHENTICATED" }), { status: 401 })));
    await expect(backendChat.consent()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("accepts additive answer fields", async () => {
    const seen = await run(stream([frame("answer", { ...ANSWER, modelStatus: "numbers_unverified", truncated: false }), frame("done", {})]));
    expect(seen[0]).toMatchObject({ type: "answer", data: { modelStatus: "numbers_unverified", truncated: false } });
  });
  it("gives up on a stream that goes quiet and says it took too long", async () => {
    vi.useFakeTimers();
    try {
      // A real fetch errors the body when its signal aborts; the stub does the same.
      vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => new Response(new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(frame("meta", { threadId: "th-1", intent: "x", retrievalMode: "keyword" })));
          init.signal?.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError")));
        },
      }), { status: 200, headers: { "content-type": "text/event-stream" } })));
      const seen: TurnEvent[] = [];
      const done = backendChat.turn("th-1", { message: "hi" }, (e) => seen.push(e));
      const outcome = expect(done).rejects.toMatchObject({ code: "BACKEND_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(TURN_IDLE_MS + 1_000);
      await outcome;
      expect(seen.map((e) => e.type)).toEqual(["meta"]);
    } finally {
      vi.useRealTimers();
    }
  });
  it("waits through a slow model call (about 20 s of silence) and still delivers the answer", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
        async start(c) {
          c.enqueue(new TextEncoder().encode(frame("meta", { threadId: "th-1", intent: "x", retrievalMode: "keyword" })));
          await new Promise((r) => setTimeout(r, 20_000));
          c.enqueue(new TextEncoder().encode(frame("answer", ANSWER) + frame("done", {})));
          c.close();
        },
      }), { status: 200, headers: { "content-type": "text/event-stream" } })));
      const seen: TurnEvent[] = [];
      const done = backendChat.turn("th-1", { message: "hi" }, (e) => seen.push(e));
      await vi.advanceTimersByTimeAsync(21_000);
      await done;
      expect(seen.map((e) => e.type)).toEqual(["meta", "answer", "done"]);
    } finally {
      vi.useRealTimers();
    }
  });
  it("gives up when the request never answers at all", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_r, reject) => { init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); })));
      const done = backendChat.turn("th-1", { message: "hi" }, () => undefined);
      const outcome = expect(done).rejects.toMatchObject({ code: "BACKEND_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(TURN_IDLE_MS + 1_000);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});
