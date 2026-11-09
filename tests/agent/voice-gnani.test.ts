// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGnaniVoice, downsample, encodeWav, languageFor, VOICE_NOTICE } from "@/agent/voice-gnani";
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
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[800]).toBeCloseTo(0.5, 2);
  });
  it("returns the input when already at or below the target rate", () => {
    const a = new Float32Array(10);
    expect(downsample(a, 16000)).toBe(a);
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

class FakeCtx {
  sampleRate = 48000;
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
  stopped = 0; closed = 0;
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
  it("falls back to browser speech when the BFF says not configured, and stays there", async () => {
    const fallback = fb();
    const f = fail(503, "VOICE_NOT_CONFIGURED");
    const v = createGnaniVoice({ fallback, fetchImpl: f as never });
    const p = v.listen();
    await tick(); feed(4800); v.stop?.();
    expect(await p).toBe("from browser speech");
    expect(stopped).toBe(1);
    expect(await v.listen()).toBe("from browser speech");
    expect(gum).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("falls back on a network error but surfaces busy and upstream failures", async () => {
    const fallback = fb();
    const net = vi.fn(async () => { throw new Error("offline"); });
    let v = createGnaniVoice({ fallback, fetchImpl: net as never });
    let p = v.listen(); await tick(); feed(4800); v.stop?.();
    expect(await p).toBe("from browser speech");
    for (const code of ["VOICE_BUSY", "VOICE_UPSTREAM_FAILED"]) {
      v = createGnaniVoice({ fallback: fb(), fetchImpl: fail(429, code) as never });
      p = v.listen(); await tick(); feed(4800); v.stop?.();
      await expect(p).rejects.toMatchObject({ code });
    }
  });
  it("returns an empty transcript and uploads nothing when no audio was captured", async () => {
    const f = ok("x");
    const v = createGnaniVoice({ fallback: fb(), fetchImpl: f as never });
    const p = v.listen(); await tick(); v.stop?.();
    expect(await p).toBe("");
    expect(f).not.toHaveBeenCalled();
    expect(stopped).toBe(1);
  });
  it("uses browser speech directly when capture is not possible", async () => {
    (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    const fallback = fb();
    expect(await createGnaniVoice({ fallback }).listen()).toBe("from browser speech");
  });
});
