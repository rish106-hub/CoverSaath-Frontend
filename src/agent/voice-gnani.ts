import type { VoiceAdapter } from "@/adapters/types";
import { AdapterError } from "@/adapters/types";
import { webVoice } from "./voice";

// Speech to text through the same-origin BFF (/api/app/voice/transcribe), which calls Gnani Vachana server-side. The browser never talks
// to Gnani and never holds a key. Gnani does not accept webm, so audio is captured, downsampled to 16 kHz mono 16-bit PCM and
// encoded as WAV here. Hard cap 30 s. Tracks are always released. Audio is not stored or logged by this app.
//
// FOR LEGAL REVIEW (not final wording, both strings below): Gnani retention terms are not in its docs, so no promise about storage is made.
// VOICE_NOTICE is shown next to the microphone while Gnani is the recipient.
export const VOICE_NOTICE = "Audio is sent to a speech service to turn it into text.";
// FOR LEGAL REVIEW: shown BEFORE the browser's own speech recognition starts. In Chrome the audio then goes to Google; other browsers
// differ. The person must start again explicitly after seeing it.
export const FALLBACK_NOTICE = "Your browser's speech service will be used instead.";

export const TARGET_RATE = 16_000;
export const MAX_SECONDS = 30;
export type VoicePref = "en" | "hi" | "both";
export const languageFor = (p: VoicePref | null | undefined): string => (p === "hi" ? "hi-IN" : p === "en" ? "en-IN" : "hi-IN,en-IN");

/** Downsample of mono float samples with a box (moving-average) low-pass over each output span, so frequencies above the new Nyquist are attenuated before decimation. Same or lower rate returns the input. */
export function downsample(input: Float32Array, from: number, to: number = TARGET_RATE): Float32Array {
  if (to >= from) return input;
  const ratio = from / to;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j]!;
    out[i] = sum / (end - start);
  }
  return out;
}

/** 44-byte RIFF/WAVE header plus 16-bit little-endian PCM, mono. */
export function encodeWav(samples: Float32Array, rate: number = TARGET_RATE): Uint8Array {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); dv.setUint32(4, 36 + dataLen, true); str(8, "WAVE");
  str(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, "data"); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

type Deps = {
  fallback?: VoiceAdapter;
  getLanguage?: () => Promise<VoicePref | null | undefined>;
  fetchImpl?: typeof fetch;
  maxSeconds?: number;
};

type Ac = AudioContext;
type AcCtor = new (opts?: AudioContextOptions) => Ac;
const acCtor = (): AcCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { AudioContext?: AcCtor; webkitAudioContext?: AcCtor };
  return w.AudioContext ?? w.webkitAudioContext;
};
const canCapture = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function" && !!acCtor();

export function createGnaniVoice(deps: Deps = {}): VoiceAdapter & { notice: string } {
  const fallback = deps.fallback ?? webVoice;
  const doFetch = deps.fetchImpl ?? ((u: string, i?: RequestInit) => fetch(u, i));
  const maxSeconds = deps.maxSeconds ?? MAX_SECONDS;
  let stopNow: (() => void) | null = null;
  let useFallback = false; // sticky only once the BFF says speech is not configured here (VOICE_NOT_CONFIGURED)
  let usingBrowser = false; // the browser's own speech service is (or is about to be) the recipient of the audio
  let fallbackSeen = false; // the person has seen FALLBACK_NOTICE and started again

  /** Browser speech, but only after FALLBACK_NOTICE was shown once: the first attempt throws a coded error, the next explicit start goes ahead. */
  async function viaFallback(): Promise<string> {
    if (!fallback.supported()) throw new AdapterError("VOICE_UNSUPPORTED");
    usingBrowser = true;
    if (!fallbackSeen) { fallbackSeen = true; throw new AdapterError("VOICE_FALLBACK_NOTICE"); }
    return fallback.listen();
  }

  async function upload(wav: Uint8Array): Promise<string> {
    const lang = languageFor(await deps.getLanguage?.().catch(() => null));
    let res: Response;
    try {
      res = await doFetch("/api/app/voice/transcribe", { method: "POST", headers: { "content-type": "audio/wav", "x-knowvia-app": "1", "x-knowvia-language": lang }, body: wav as BodyInit, cache: "no-store" });
    } catch {
      throw new AdapterError("BACKEND_UNREACHABLE", true);
    }
    const body = (await res.json().catch(() => ({}))) as { transcript?: unknown; code?: unknown; retryable?: unknown };
    if (res.ok && typeof body.transcript === "string") return body.transcript.trim();
    throw new AdapterError(typeof body.code === "string" ? body.code : "VOICE_UPSTREAM_FAILED", body.retryable === true);
  }

  return {
    get notice() { return usingBrowser || useFallback || !canCapture() ? FALLBACK_NOTICE : VOICE_NOTICE; },
    supported: () => canCapture() || fallback.supported(),
    async listen() {
      if (useFallback || !canCapture()) return viaFallback();
      // Created synchronously, still inside the click or key handler, so Safari treats it as a user gesture. Resumed before capture starts.
      const Ctx = acCtor() as AcCtor;
      let ctx: Ac;
      try { ctx = new Ctx({ sampleRate: TARGET_RATE }); } catch { ctx = new Ctx(); }
      const resumed = ctx.state === "suspended" ? Promise.resolve(ctx.resume?.()).catch(() => undefined) : Promise.resolve();
      let aborted = false; // stop() arrived while getUserMedia was still pending
      stopNow = () => { aborted = true; };
      const closeCtx = () => { void Promise.resolve(ctx.close?.()).catch(() => undefined); };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        stopNow = null;
        closeCtx();
        const name = (e as { name?: string } | null)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") throw new AdapterError("VOICE_MIC_DENIED"); // no fallback: the person said no
        throw new AdapterError("VOICE_UNSUPPORTED");
      }
      const stopTracks = () => stream.getTracks().forEach((t) => t.stop());
      await resumed;
      if (aborted) { stopNow = null; stopTracks(); closeCtx(); return ""; }
      // A context below 16 kHz cannot make a correct 16 kHz clip, and a wrong header would change the pitch. Refuse with a coded error.
      if (!(ctx.sampleRate >= TARGET_RATE)) { stopNow = null; stopTracks(); closeCtx(); throw new AdapterError("VOICE_RATE_UNSUPPORTED"); }
      const chunks: Float32Array[] = [];
      let total = 0;
      let proc: ScriptProcessorNode | null = null;
      let src: MediaStreamAudioSourceNode | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const release = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        try { proc?.disconnect(); src?.disconnect(); } catch { /* already disconnected */ }
        if (proc) proc.onaudioprocess = null;
        stopTracks();
        closeCtx();
        stopNow = null;
      };
      const captured = new Promise<void>((done) => {
        stopNow = done;
        try {
          src = ctx.createMediaStreamSource(stream);
          proc = ctx.createScriptProcessor(4096, 1, 1);
          const limit = ctx.sampleRate * maxSeconds;
          proc.onaudioprocess = (ev) => {
            if (total >= limit) return;
            const data = ev.inputBuffer.getChannelData(0);
            const take = Math.min(data.length, limit - total);
            chunks.push(new Float32Array(data.subarray(0, take)));
            total += take;
            if (total >= limit) done();
          };
          src.connect(proc);
          proc.connect(ctx.destination);
          timer = setTimeout(done, maxSeconds * 1000);
        } catch {
          done();
        }
      });
      if (aborted) stopNow?.(); // stop() landed between the check above and here
      await captured;
      const rate = ctx.sampleRate;
      release();
      if (total === 0) return "";
      const all = new Float32Array(total);
      let o = 0;
      for (const c of chunks) { all.set(c, o); o += c.length; }
      const wav = encodeWav(downsample(all, rate));
      try {
        const text = await upload(wav);
        usingBrowser = false; fallbackSeen = false;
        return text;
      } catch (e) {
        const code = e instanceof AdapterError ? e.code : "";
        // Speech service not set up here (sticky), the call was refused for a demo session, or the network is down: the browser's own speech
        // service is the next option, but only after its notice. Bad audio, busy, rate-limited and upstream failures surface as they are.
        if (code === "VOICE_NOT_CONFIGURED") { useFallback = true; return viaFallback(); }
        if (code === "DEMO_READ_ONLY" || code === "BACKEND_UNREACHABLE") return viaFallback();
        throw e;
      }
    },
    stop() {
      if (stopNow) stopNow();
      else fallback.stop?.();
    },
  };
}
