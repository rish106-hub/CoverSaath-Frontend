import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import type { FetchLike } from "./client";

// Server-side client for Gnani Vachana speech-to-text (REST, POST /stt/v3). The key is read lazily from GNANI_API_KEY (server-only,
// never NEXT_PUBLIC, not in REQUIRED_ENV so the rest of the app boots without it). Audio, transcripts and the key are never logged,
// and upstream error bodies are never returned. Only the code and status are used.

export const GNANI_URL = "https://api.vachana.ai/stt/v3";
export const GNANI_MODEL = "prisma-v3.0";
export const GNANI_TIMEOUT_MS = 20_000;
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 30;
export const SAMPLE_RATE = 16_000;

/** language_code values the app may send. en -> en-IN, hi -> hi-IN, both -> a hint list. */
export const LANGUAGES = ["en-IN", "hi-IN", "hi-IN,en-IN"] as const;
export type Language = (typeof LANGUAGES)[number];
export const isLanguage = (v: string | null): v is Language => !!v && (LANGUAGES as readonly string[]).includes(v);

const out = z.object({
  transcript: z.string().max(5000),
  detected_language_code: z.string().max(40).optional(),
  language_code: z.string().max(40).optional(),
  language: z.string().max(40).optional(),
  truncated: z.boolean().optional(),
}).loose();
export type Transcript = { transcript: string; language?: string; truncated?: boolean };

/**
 * Spend gate, read at call time. Gnani STT runs only when GNANI_STT_ENABLED is exactly "true" AND GNANI_API_KEY is present. Otherwise a
 * coded 503 VOICE_NOT_CONFIGURED (the app then falls back to browser speech) and nothing else is revealed.
 */
export function gnaniKey(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GNANI_STT_ENABLED !== "true") throw new AppError(503, "VOICE_NOT_CONFIGURED");
  const k = env.GNANI_API_KEY;
  if (!k || !k.trim()) throw new AppError(503, "VOICE_NOT_CONFIGURED");
  return k.trim();
}

/** Checks a RIFF/WAVE header: PCM, mono, 16 kHz, 16-bit, a data chunk inside the buffer, at most 30 s. Returns the duration in seconds. */
export function checkWav(buf: Uint8Array): number {
  const bad = () => new AppError(400, "VOICE_BAD_AUDIO");
  if (buf.length < 44) throw bad();
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o]!, buf[o + 1]!, buf[o + 2]!, buf[o + 3]!);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw bad();
  let pos = 12;
  let fmtOk = false;
  let dataLen = -1;
  while (pos + 8 <= buf.length) {
    const id = tag(pos);
    const len = dv.getUint32(pos + 4, true);
    if (id === "fmt ") {
      if (len < 16 || pos + 8 + 16 > buf.length) throw bad();
      const fmt = dv.getUint16(pos + 8, true), ch = dv.getUint16(pos + 10, true), rate = dv.getUint32(pos + 12, true), bits = dv.getUint16(pos + 22, true);
      if (fmt !== 1 || ch !== 1 || rate !== SAMPLE_RATE || bits !== 16) throw bad();
      fmtOk = true;
    } else if (id === "data") {
      dataLen = Math.min(len, buf.length - (pos + 8)); // a streamed WAV may carry a too-large length; trust the bytes present
      break;
    }
    pos += 8 + len + (len % 2);
  }
  if (!fmtOk || dataLen <= 0) throw bad();
  const seconds = dataLen / (SAMPLE_RATE * 2);
  if (seconds > MAX_AUDIO_SECONDS + 0.5) throw new AppError(413, "VOICE_TOO_LARGE");
  return seconds;
}

/**
 * Best-effort per-household limiter: GNANI_STT_PER_HOUR (default 20) and GNANI_STT_PER_DAY (default 100) clips. In memory, per serverless
 * instance: instances do not share memory, so the real ceiling is limit x instances. A shared store (for example Redis or the database)
 * is an OWNER DECISION and is deliberately not added here. 429 VOICE_RATE_LIMITED.
 */
const HOUR = 3_600_000, DAY = 86_400_000;
const hits = new Map<string, number[]>();
const intEnv = (v: string | undefined, d: number) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : d; };
export function checkVoiceQuota(householdId: string, env: NodeJS.ProcessEnv = process.env, now: number = Date.now()): void {
  const perHour = intEnv(env.GNANI_STT_PER_HOUR, 20), perDay = intEnv(env.GNANI_STT_PER_DAY, 100);
  const list = (hits.get(householdId) ?? []).filter((t) => now - t < DAY);
  if (list.length >= perDay || list.filter((t) => now - t < HOUR).length >= perHour) {
    hits.set(householdId, list);
    throw new AppError(429, "VOICE_RATE_LIMITED", false, 60);
  }
  list.push(now);
  hits.set(householdId, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= DAY)) hits.delete(k); // bound memory
}
export const _resetVoiceQuota = () => hits.clear();

/** Per-session single flight. Gnani allows one active request per account, so a second one while busy is a coded 429. */
const busy = new Set<string>();
export async function withSessionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (busy.has(key)) throw new AppError(429, "VOICE_BUSY", true, 3);
  busy.add(key);
  try {
    return await fn();
  } finally {
    busy.delete(key);
  }
}
export const _resetVoiceLocks = () => busy.clear();

export async function transcribe(audio: Uint8Array, language: Language, opts: { fetch?: FetchLike; timeoutMs?: number; key?: string } = {}): Promise<Transcript> {
  const key = opts.key ?? gnaniKey();
  const doFetch: FetchLike = opts.fetch ?? ((u, i) => globalThis.fetch(u, i));
  const form = new FormData();
  form.append("audio_file", new Blob([audio as BlobPart], { type: "audio/wav" }), "audio.wav");
  form.append("language_code", language);
  form.append("model", GNANI_MODEL);
  form.append("format", "transcribe");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? GNANI_TIMEOUT_MS);
  try {
    const res = await doFetch(GNANI_URL, { method: "POST", headers: { "X-API-Key-ID": key }, body: form, signal: controller.signal, cache: "no-store", redirect: "error" });
    if (res.status === 429) throw new AppError(429, "VOICE_BUSY", true, 3);
    if (!res.ok) {
      // Status code only: no body, audio, transcript or key. 401/402/403 mean a bad key, no credit or no access: the owner needs to see them.
      console.warn(JSON.stringify({ event: "VOICE_UPSTREAM_STATUS", status: res.status }));
      if (res.status === 422) throw new AppError(400, "VOICE_BAD_AUDIO"); // Gnani could not read the clip
      throw new AppError(502, "VOICE_UPSTREAM_FAILED", res.status >= 500); // 401, 402, 403, 504 and the rest: no upstream body is read or forwarded
    }
    const parsed = out.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new AppError(502, "VOICE_UPSTREAM_FAILED");
    const d = parsed.data;
    const lang = d.detected_language_code ?? d.language_code ?? d.language;
    return { transcript: d.transcript.trim(), ...(lang ? { language: lang } : {}), ...(d.truncated ? { truncated: true } : {}) };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(502, "VOICE_UPSTREAM_FAILED", true); // timeout or network: the error text could carry the URL, so it is dropped
  } finally {
    clearTimeout(timer);
  }
}
