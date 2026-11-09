import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/server/backend/session";

const SECRET = "s".repeat(40);
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined), set: () => {}, delete: () => {} }), headers: async () => ({ get: () => null }) }));

import { POST } from "@/app/api/app/voice/transcribe/route";
import { _resetVoiceLocks, _resetVoiceQuota, checkVoiceQuota, checkWav, transcribe } from "@/server/backend/gnani";
import { encodeWav } from "@/agent/voice-gnani";

const KEY = "gnani-secret-key-123";
const wav = (seconds = 1) => encodeWav(new Float32Array(Math.floor(16000 * seconds)).fill(0.1));
const req = (body: BodyInit | null = wav() as BodyInit, headers: Record<string, string> = {}) => {
  const len = body instanceof Uint8Array ? String(body.length) : undefined;
  return new Request("http://app.test/api/app/voice/transcribe", { method: "POST", headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "audio/wav", "x-knowvia-language": "en-IN", ...(len ? { "content-length": len } : {}), ...headers }, body });
};
const streamed = (chunks: Uint8Array[], headers: Record<string, string> = {}) =>
  new Request("http://app.test/api/app/voice/transcribe", {
    method: "POST", duplex: "half",
    headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "audio/wav", "x-knowvia-language": "en-IN", ...headers },
    body: new ReadableStream({ start(c) { for (const k of chunks) c.enqueue(k); c.close(); } }),
  } as RequestInit);

type Call = { url: string; headers: Record<string, string>; form: FormData };
let calls: Call[];
let up: { status: number; body: unknown } | "throw" | "hang";
const spies: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  process.env.GNANI_API_KEY = KEY;
  process.env.GNANI_STT_ENABLED = "true";
  delete process.env.GNANI_STT_PER_HOUR;
  delete process.env.GNANI_STT_PER_DAY;
  cookieValue = seal({ t: "tok-123456789012345", h: "h1", m: "m1", exp: Date.now() + 60_000 }, SECRET);
  calls = [];
  up = { status: 200, body: { transcript: " is cataract covered ", language_code: "en-IN" } };
  _resetVoiceLocks();
  _resetVoiceQuota();
  for (const m of ["log", "info", "warn", "error", "debug"] as const) spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, form: init.body as FormData });
    if (up === "throw") throw new Error(`network down ${KEY} ${url}`);
    if (up === "hang") return new Promise<Response>(() => {});
    return new Response(JSON.stringify(up.body), { status: up.status });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  spies.splice(0).forEach((s) => s.mockRestore());
  delete process.env.GNANI_API_KEY;
  delete process.env.GNANI_STT_ENABLED;
});

describe("voice transcribe BFF", () => {
  it("sends multipart to Gnani with the key header and returns the transcript", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, transcript: "is cataract covered", language: "en-IN" });
    const c = calls[0] as Call;
    expect(c.url).toBe("https://api.vachana.ai/stt/v3");
    expect(c.headers["X-API-Key-ID"]).toBe(KEY);
    expect(c.form.get("language_code")).toBe("en-IN");
    expect(c.form.get("model")).toBe("prisma-v3.0");
    expect(c.form.get("format")).toBe("transcribe");
    expect(c.form.get("audio_file")).toBeInstanceOf(Blob);
  });
  it("answers 503 VOICE_NOT_CONFIGURED when the key is missing, without calling Gnani", async () => {
    delete process.env.GNANI_API_KEY;
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("VOICE_NOT_CONFIGURED");
    expect(calls).toHaveLength(0);
    process.env.GNANI_API_KEY = "   ";
    expect((await POST(req())).status).toBe(503);
  });
  it("refuses demo sessions, missing sessions and a missing app header", async () => {
    cookieValue = seal({ t: "", h: "demo", m: "m", exp: Date.now() + 60_000, demo: true }, SECRET);
    vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
    const d = await POST(req());
    expect(d.status).toBe(403);
    expect((await d.json()).code).toBe("DEMO_READ_ONLY");
    cookieValue = undefined;
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req(wav() as BodyInit, { "x-knowvia-app": "0" }))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("rejects oversize (413), wrong type (415), bad header and over-long audio", async () => {
    expect((await POST(req(new Uint8Array(2 * 1024 * 1024 + 1) as BodyInit))).status).toBe(413);
    expect((await POST(req(wav() as BodyInit, { "content-type": "audio/webm" }))).status).toBe(415);
    expect((await POST(req(new Uint8Array(100) as BodyInit))).status).toBe(400);
    expect((await POST(req(wav() as BodyInit, { "x-knowvia-language": "fr-FR" }))).status).toBe(400);
    const long = await POST(req(wav(31) as BodyInit));
    expect(long.status).toBe(413);
    expect(calls).toHaveLength(0);
    expect(checkWav(wav(30))).toBeCloseTo(30, 1);
    const stereo = wav();
    new DataView(stereo.buffer).setUint16(22, 2, true);
    expect(() => checkWav(stereo)).toThrow();
  });
  it("allows one request at a time per session (429 VOICE_BUSY) and frees the lock after", async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", () => new Promise<Response>((r) => { release = r; }));
    const first = POST(req());
    await new Promise((r) => setTimeout(r, 20));
    const second = await POST(req());
    expect(second.status).toBe(429);
    expect((await second.json()).code).toBe("VOICE_BUSY");
    release(new Response(JSON.stringify({ transcript: "ok" }), { status: 200 }));
    expect((await first).status).toBe(200);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ transcript: "again" }), { status: 200 }));
    expect((await POST(req())).status).toBe(200);
  });
  it("maps upstream errors without leaking bodies, and frees the lock after a failure", async () => {
    for (const [status, code, http] of [[401, "VOICE_UPSTREAM_FAILED", 502], [402, "VOICE_UPSTREAM_FAILED", 502], [403, "VOICE_UPSTREAM_FAILED", 502], [429, "VOICE_BUSY", 429], [504, "VOICE_UPSTREAM_FAILED", 502], [422, "VOICE_BAD_AUDIO", 400]] as const) {
      up = { status, body: { error: "UPSTREAM SECRET BODY", key: KEY } };
      const res = await POST(req());
      const text = JSON.stringify(await res.json());
      expect(res.status).toBe(http);
      expect(text).toContain(code);
      expect(text).not.toContain("UPSTREAM SECRET");
      expect(text).not.toContain(KEY);
    }
    up = { status: 200, body: { nope: 1 } };
    expect((await POST(req())).status).toBe(502);
  });
  it("never leaks the key, URL or audio in errors or logs on a network failure", async () => {
    up = "throw";
    const res = await POST(req());
    const text = JSON.stringify(await res.json());
    expect(res.status).toBe(502);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("vachana");
    const logged = spies.flatMap((s) => s.mock.calls).map((c) => JSON.stringify(c)).join("");
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain("cataract");
  });
  it("is off unless GNANI_STT_ENABLED is exactly true, even with a key", async () => {
    for (const v of [undefined, "", "1", "TRUE", "false"]) {
      if (v === undefined) delete process.env.GNANI_STT_ENABLED; else process.env.GNANI_STT_ENABLED = v;
      const res = await POST(req());
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe("VOICE_NOT_CONFIGURED");
    }
    expect(calls).toHaveLength(0);
  });
  it("limits clips per household (429 VOICE_RATE_LIMITED), configurable, and does not count rejected clips", async () => {
    process.env.GNANI_STT_PER_HOUR = "2";
    expect((await POST(req())).status).toBe(200);
    expect((await POST(req(new Uint8Array(100) as BodyInit))).status).toBe(400); // bad audio is not counted
    expect((await POST(req())).status).toBe(200);
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("VOICE_RATE_LIMITED");
    expect(calls).toHaveLength(2);
    cookieValue = seal({ t: "tok-123456789012345", h: "other", m: "m1", exp: Date.now() + 60_000 }, SECRET);
    expect((await POST(req())).status).toBe(200); // another household has its own budget
  });
  it("quota windows: hour resets, day cap holds, bad env falls back to defaults", () => {
    const env = { GNANI_STT_PER_HOUR: "2", GNANI_STT_PER_DAY: "3" } as unknown as NodeJS.ProcessEnv;
    const t0 = 1_000_000_000;
    checkVoiceQuota("q", env, t0); checkVoiceQuota("q", env, t0 + 1);
    expect(() => checkVoiceQuota("q", env, t0 + 2)).toThrow();
    checkVoiceQuota("q", env, t0 + 3_600_001); // an hour later: allowed again (third of the day)
    expect(() => checkVoiceQuota("q", env, t0 + 3_600_002)).toThrow(); // day cap of 3 reached
    checkVoiceQuota("q", env, t0 + 86_400_100); // a day later
    const junk = { GNANI_STT_PER_HOUR: "abc", GNANI_STT_PER_DAY: "-1" } as unknown as NodeJS.ProcessEnv;
    for (let i = 0; i < 20; i++) checkVoiceQuota("d", junk, t0);
    expect(() => checkVoiceQuota("d", junk, t0)).toThrow();
  });
  it("needs Content-Length: missing, not a number, or over the cap is refused before reading", async () => {
    const noLen = await POST(streamed([wav()]));
    expect(noLen.status).toBe(411);
    const nan = await POST(req(wav() as BodyInit, { "content-length": "abc" }));
    expect(nan.status).toBe(411);
    const over = await POST(req(wav() as BodyInit, { "content-length": String(2 * 1024 * 1024 + 1) }));
    expect(over.status).toBe(413);
    expect((await over.json()).code).toBe("VOICE_TOO_LARGE");
    expect(calls).toHaveLength(0);
  });
  it("aborts a streamed body that lies about its length once it crosses 2 MB", async () => {
    const chunk = new Uint8Array(512 * 1024);
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({ pull(c) { pulled += 1; c.enqueue(chunk); if (pulled > 40) c.close(); } });
    const r = new Request("http://app.test/api/app/voice/transcribe", {
      method: "POST", duplex: "half", body,
      headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "audio/wav", "x-knowvia-language": "en-IN", "content-length": "1000" },
    } as RequestInit);
    const res = await POST(r);
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThan(10); // stopped reading, did not drain the whole stream
    expect(calls).toHaveLength(0);
  });
  it("surfaces truncated, prefers detected_language_code, and logs only the status for 401/402/403", async () => {
    up = { status: 200, body: { transcript: "hi", detected_language_code: "hi-IN", language_code: "en-IN", truncated: true } };
    expect(await (await POST(req())).json()).toEqual({ ok: true, transcript: "hi", language: "hi-IN", truncated: true });
    up = { status: 200, body: { transcript: "hi", language: "en" } };
    expect(await (await POST(req())).json()).toEqual({ ok: true, transcript: "hi", language: "en" });
    for (const status of [401, 402, 403]) {
      up = { status, body: { error: "UPSTREAM SECRET BODY", key: KEY } };
      expect((await POST(req())).status).toBe(502);
    }
    const lines = spies.flatMap((s) => s.mock.calls).map((c) => String(c[0]));
    expect(lines.filter((l) => l.includes("VOICE_UPSTREAM_STATUS"))).toEqual([401, 402, 403].map((st) => JSON.stringify({ event: "VOICE_UPSTREAM_STATUS", status: st })));
    expect(lines.join("")).not.toContain("SECRET");
    expect(lines.join("")).not.toContain(KEY);
  });
  it("aborts a hanging Gnani call on timeout (fake timers) and releases the session lock", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", (_u: string, init: RequestInit) => new Promise<Response>((_r, rej) => { init.signal?.addEventListener("abort", () => rej(new Error("aborted"))); }));
      const p = POST(req());
      await vi.advanceTimersByTimeAsync(20_001);
      const res = await p;
      expect(res.status).toBe(502);
      expect((await res.json()).code).toBe("VOICE_UPSTREAM_FAILED");
      vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ transcript: "after" }), { status: 200 }));
      expect((await POST(req())).status).toBe(200); // lock was released
    } finally {
      vi.useRealTimers();
    }
  });
  it("transcribe() itself times out via its own timeoutMs", async () => {
    vi.useFakeTimers();
    try {
      const f = (_u: string, init: RequestInit) => new Promise<Response>((_r, rej) => { init.signal?.addEventListener("abort", () => rej(new Error("aborted"))); });
      const p = transcribe(wav(), "en-IN", { fetch: f as never, key: KEY, timeoutMs: 500 });
      const assertion = expect(p).rejects.toMatchObject({ code: "VOICE_UPSTREAM_FAILED", retryable: true });
      await vi.advanceTimersByTimeAsync(501);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
