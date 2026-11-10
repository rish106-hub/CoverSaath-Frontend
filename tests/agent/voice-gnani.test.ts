// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGnaniVoice, downsample, encodeWav, FALLBACK_NOTICE, languageFor, VOICE_NOTICE } from "@/agent/voice-gnani";
import type { VoiceAdapter } from "@/adapters/types";

const ascii = (u: Uint8Array, o: number, n: number) => String.fromCharCode(...u.subarray(o, o + n));

describe("WAV encoding", () => {
  it("writes a correct 44-byte header and 16-bit samples", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]));
    const dv = new DataView(wav.buffer);
    expect(wav.length).toBe(44 + 8);
    expect(ascii(wav, 0, 4)).toBe("RIFF");
    expect(dv.getUint32(4, true)).toBe(36 + 8);
    expect(ascii(wav, 8, 8)).toBe("WAVEfmt ");
    expect(dv.getUint32(16, true)).toBe(16);
    expect(dv.getUint16(20, true)).toBe(1);
    expect(dv.getUint16(22, true)).toBe(1);
    expect(dv.getUint32(24, true)).toBe(16000);
    expect(dv.getUint32(28, true)).toBe(32000);
    expect(dv.getUint16(32, true)).toBe(2);
    expect(dv.getUint16(34, true)).toBe(16);
    expect(ascii(wav, 36, 4)).toBe("data");
    expect(dv.getUint32(40, true)).toBe(8);
    expect([44, 46, 48, 50].map((o) => dv.getInt16(o, true))).toEqual([0, 32767, -32768, 16383]);
  });
  it("clips out-of-range samples", () => {
    const dv = new DataView(encodeWav(new Float32Array([5, -5])).buffer);
    expect(dv.getInt16(44, true)).toBe(32767);
    expect(dv.getInt16(46, true)).toBe(-32768);
  });
});

describe("downsample", () => {
  it("48 kHz to 16 kHz gives a third of the samples and keeps a ramp", () => {
    const input = Float32Array.from({ length: 4800 }, (_, i) => i / 4800);
    const out = downsample(input, 48000);
    expect(out.length).toBe(1600);
    expect(out[0]).toBeCloseTo(0, 3);
    expect(out[800]).toBeCloseTo(0.5, 2);
  });
  it("returns the input when already at or below the target rate", () => {
    const a = new Float32Array(10);
    expect(downsample(a, 16000)).toBe(a);
  });
  it("low-passes before decimating: a tone above the new Nyquist is attenuated, a low tone is kept", () => {
    const tone = (hz: number) => Float32Array.from({ length: 48000 }, (_, i) => Math.sin((2 * Math.PI * hz * i) / 48000));
    const rms = (a: Float32Array) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / a.length);
    expect(rms(downsample(tone(15000), 48000))).toBeLessThan(0.3); // would alias to 1 kHz at full strength without a filter
    expect(rms(downsample(tone(500), 48000))).toBeGreaterThan(0.65);
  });
  it("maps the voice preference to a language code", () => {
    expect([languageFor("en"), languageFor("hi"), languageFor("both"), languageFor(null)]).toEqual(["en-IN", "hi-IN", "hi-IN,en-IN", "hi-IN,en-IN"]);
  });
});

// ---- capture with fakes -------------------------------------------------------------------------------------------------------
let stopped = 0;
let closed = 0;
let procNode: { onaudioprocess: ((e: unknown) => void) | null };
const track = { stop: () => { stopped += 1; } };
const stream = { getTracks: () => [track] };

let ctxs: FakeCtx[] = [];
let ctxRate = 48000;
let ctxStartsSuspended = false;
class FakeCtx {
  sampleRate = ctxRate;
  state = ctxStartsSuspended ? "suspended" : "running";
  opts: unknown;
  resumed = 0;
  constructor(opts?: unknown) { this.opts = opts; ctxs.push(this); }
  resume() { this.resumed += 1; this.state = "running"; return Promise.resolve(); }
  destination = {};
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createScriptProcessor() { procNode = { onaudioprocess: null, connect() {}, disconnect() {} } as never; return procNode as never; }
  close() { closed += 1; return Promise.resolve(); }
}
const feed = (frames: number) => procNode.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(frames).fill(0.2) } });
const tick = () => new Promise((r) => setTimeout(r, 0));

const fb = (over: Partial<VoiceAdapter> = {}): VoiceAdapter & { listen: ReturnType<typeof vi.fn> } => ({ supported: () => true, listen: vi.fn(async () => "from browser speech"), stop: vi.fn(), ...over }) as never;
let gum: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stopped = 0; closed = 0; ctxs = []; ctxRate = 48000; ctxStartsSuspended = false;
  gum = vi.fn(async () => stream);
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: gum }, configurable: true });
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
});
afterEach(() => { vi.useRealTimers(); });

const ok = (t: string) => vi.fn(async () => new Response(JSON.stringify({ ok: true, transcript: t }), { status: 200 }));
const fail = (status: number, code: string) => vi.fn(async () => new Response(JSON.stringify({ ok: false, code }), { status }));

describe("GnaniVoice", () => {
  it("is supported with getUserMedia and AudioContext, and carries the notice", () => {
    const v = createGnaniVoice({ fallback: fb({ supported: () => false }) });
    expect(v.supported()).toBe(true);
    expect(v.notice).toBe(VOICE_NOTICE);
    (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    expect(v.supported()).toBe(false);
  });
  it("records, stops, uploads a 16 kHz WAV with headers, releases tracks and returns the transcript", async () => {
    const f = ok("hello there");
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: f as never, getLanguage: async () => "hi" });
    const p = v.listen();
    await tick();
    feed(4800); feed(4800);
    v.stop?.();
    expect(await p).toBe("hello there");
    expect(stopped).toBe(1);
    expect(closed).toBe(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/app/voice/transcribe");
    const h = init.headers as Record<string, string>;
    expect(h["content-type"]).toBe("audio/wav");
    expect(h["x-knowvia-app"]).toBe("1");
    expect(h["x-knowvia-language"]).toBe("hi-IN");
    const body = init.body as Uint8Array;
    expect(ascii(body, 0, 4)).toBe("RIFF");
    expect(new DataView(body.buffer).getUint32(24, true)).toBe(16000);
    expect(body.length).toBe(44 + (9600 / 3) * 2);
  });
  it("caps recording at 30 seconds on its own", async () => {
    vi.useFakeTimers();
    const f = ok("long");
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: f as never });
    const p = v.listen();
    await vi.advanceTimersByTimeAsync(0);
    feed(48000 * 20);
    feed(48000 * 20); // 40 s offered, only 30 s kept
    expect(await p).toBe("long");
    const body = (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as Uint8Array;
    expect(body.length).toBe(44 + 16000 * 30 * 2);
    expect(stopped).toBe(1);
  });
  it("caps by timer when audio is slow", async () => {
    vi.useFakeTimers();
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: ok("x") as never });
    const p = v.listen();
    await vi.advanceTimersByTimeAsync(0);
    feed(4800);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await p).toBe("x");
    expect(stopped).toBe(1);
  });
  it("does not fall back when the microphone is denied", async () => {
    gum.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    const fallback = fb();
    const v = createGnaniVoice({ fallback, fetchImpl: ok("x") as never });
    await expect(v.listen()).rejects.toMatchObject({ code: "VOICE_MIC_DENIED" });
    expect(fallback.listen).not.toHaveBeenCalled();
  });
  it("not configured: shows the browser-speech notice first, needs an explicit second start, and stays on browser speech", async () => {
    const fallback = fb();
    const f = fail(503, "VOICE_NOT_CONFIGURED");
    const v = createGnaniVoice({ fallback, fetchImpl: f as never });
    expect(v.notice).toBe(VOICE_NOTICE);
    const p = v.listen();
    await tick(); feed(4800); v.stop?.();
    await expect(p).rejects.toMatchObject({ code: "VOICE_FALLBACK_NOTICE" });
    expect(fallback.listen).not.toHaveBeenCalled(); // nothing reaches the browser speech service before the notice
    expect(stopped).toBe(1);
    expect(v.notice).toBe(FALLBACK_NOTICE);
    expect(await v.listen()).toBe("from browser speech");
    expect(await v.listen()).toBe("from browser speech");
    expect(gum).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("a network error also shows the notice first, but is not sticky; busy, upstream, rate-limit and bad audio surface", async () => {
    const fallback = fb();
    const net = vi.fn(async () => { throw new Error("offline"); });
    let v = createGnaniVoice({ fallback, fetchImpl: net as never });
    let p = v.listen(); await tick(); feed(4800); v.stop?.();
    await expect(p).rejects.toMatchObject({ code: "VOICE_FALLBACK_NOTICE" });
    expect(fallback.listen).not.toHaveBeenCalled();
    p = v.listen(); await tick(); feed(4800); v.stop?.(); // second start records again (not sticky) and the notice was already seen
    expect(await p).toBe("from browser speech");
    expect(gum).toHaveBeenCalledTimes(2);
    for (const code of ["VOICE_BUSY", "VOICE_UPSTREAM_FAILED", "VOICE_RATE_LIMITED", "VOICE_BAD_AUDIO"]) {
      const g = fb();
      v = createGnaniVoice({ fallback: g, fetchImpl: fail(429, code) as never });
      p = v.listen(); await tick(); feed(4800); v.stop?.();
      await expect(p).rejects.toMatchObject({ code });
      expect(g.listen).not.toHaveBeenCalled();
    }
  });
  it("a demo-session refusal falls back with the notice and is not sticky; bad audio never makes the session sticky", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, code: "DEMO_READ_ONLY" }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, code: "VOICE_BAD_AUDIO" }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, transcript: "gnani again" }), { status: 200 }));
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: f as never });
    let p = v.listen(); await tick(); feed(4800); v.stop?.();
    await expect(p).rejects.toMatchObject({ code: "VOICE_FALLBACK_NOTICE" });
    p = v.listen(); await tick(); feed(4800); v.stop?.();
    await expect(p).rejects.toMatchObject({ code: "VOICE_BAD_AUDIO" });
    p = v.listen(); await tick(); feed(4800); v.stop?.();
    expect(await p).toBe("gnani again");
    expect(v.notice).toBe(VOICE_NOTICE);
    expect(gum).toHaveBeenCalledTimes(3);
  });
  it("creates the AudioContext synchronously with a 16 kHz request, and resumes a suspended (Safari) context before capture", async () => {
    ctxStartsSuspended = true;
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: ok("safari") as never });
    const p = v.listen();
    expect(ctxs).toHaveLength(1); // created before any await: still inside the click handler
    expect(ctxs[0]?.opts).toEqual({ sampleRate: 16000 });
    expect(ctxs[0]?.resumed).toBe(1);
    await tick();
    expect(ctxs[0]?.state).toBe("running");
    feed(4800); v.stop?.();
    expect(await p).toBe("safari");
  });
  it("uses the real rate when the context ignores the 16 kHz request (44.1 kHz) and still sends a 16 kHz WAV", async () => {
    ctxRate = 44100;
    const f = ok("x");
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: f as never });
    const p = v.listen(); await tick(); feed(44100); v.stop?.();
    await p;
    const body = (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as Uint8Array;
    expect(new DataView(body.buffer).getUint32(24, true)).toBe(16000);
    expect(body.length).toBe(44 + 16000 * 2);
  });
  it("refuses, with a code and released tracks, when the context rate is below 16 kHz", async () => {
    ctxRate = 8000;
    const f = ok("x");
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: f as never });
    await expect(v.listen()).rejects.toMatchObject({ code: "VOICE_RATE_UNSUPPORTED" });
    expect(f).not.toHaveBeenCalled();
    expect(stopped).toBe(1);
    expect(closed).toBe(1);
  });
  it("stop() while getUserMedia is pending releases the stream as soon as it resolves and returns nothing", async () => {
    let grant: (s: unknown) => void = () => {};
    gum.mockImplementationOnce(() => new Promise((r) => { grant = r; }));
    const f = ok("x");
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: f as never });
    const p = v.listen();
    v.stop?.(); // the person let go before the permission prompt resolved
    expect(stopped).toBe(0);
    grant(stream);
    expect(await p).toBe("");
    expect(stopped).toBe(1);
    expect(closed).toBe(1);
    expect(f).not.toHaveBeenCalled();
  });
  it("closes the context when getUserMedia fails", async () => {
    gum.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NotFoundError" }));
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: ok("x") as never });
    await expect(v.listen()).rejects.toMatchObject({ code: "VOICE_UNSUPPORTED" });
    expect(closed).toBe(1);
  });
  it("returns an empty transcript and uploads nothing when no audio was captured", async () => {
    const f = ok("x");
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: f as never });
    const p = v.listen(); await tick(); v.stop?.();
    expect(await p).toBe("");
    expect(f).not.toHaveBeenCalled();
    expect(stopped).toBe(1);
  });
  it("when capture is not possible: notice first, then browser speech on the next explicit start; unsupported browser speech is coded", async () => {
    (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    const fallback = fb();
    const v = createGnaniVoice({ fallback });
    expect(v.notice).toBe(FALLBACK_NOTICE);
    await expect(v.listen()).rejects.toMatchObject({ code: "VOICE_FALLBACK_NOTICE" });
    expect(fallback.listen).not.toHaveBeenCalled();
    expect(await v.listen()).toBe("from browser speech");
    await expect(createGnaniVoice({ fallback: fb({ supported: () => false }) }).listen()).rejects.toMatchObject({ code: "VOICE_UNSUPPORTED" });
  });
});
