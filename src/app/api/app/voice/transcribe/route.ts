import { runtime as backendRuntime, readSession, json, failure, AppError } from "@/server/backend";
import { assertSameOrigin } from "@/server/backend/guard";
import { MAX_AUDIO_BYTES, checkWav, checkVoiceQuota, gnaniKey, isLanguage, transcribe, withSessionLock } from "@/server/backend/gnani";
import { readCappedBody } from "@/server/backend/body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Speech to text through Gnani Vachana. A signed-in, non-demo session only (a demo session gets DEMO_READ_ONLY and keeps free browser speech).
 * Spend guard: GNANI_STT_ENABLED=true plus a key, a per-household in-memory limiter (best effort, per instance) and a per-session lock.
 * Body: one WAV (16 kHz mono 16-bit, at most 30 s, 2 MB). Nothing is stored or logged. FOR LEGAL REVIEW: the audio leaves the app for a
 * third-party speech service; Gnani retention terms are not in its docs.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { config } = backendRuntime();
    const session = await readSession(config.cookieSecret);
    if (!session) throw new AppError(401, "UNAUTHENTICATED");
    const key = gnaniKey(); // spend gate (GNANI_STT_ENABLED and a key), read here per request, never at import
    if ((req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() !== "audio/wav") throw new AppError(415, "VOICE_BAD_AUDIO");
    const lang = req.headers.get("x-knowvia-language");
    if (!isLanguage(lang)) throw new AppError(400, "INVALID_INPUT");
    const audio = await readCappedBody(req, MAX_AUDIO_BYTES, "VOICE_TOO_LARGE"); // Content-Length required, stream read with a byte counter
    checkWav(audio);
    const result = await withSessionLock(`${session.h}:${session.m}`, async () => {
      checkVoiceQuota(session.h); // counted only once the clip is valid and this session is not already busy
      return transcribe(audio, lang, { key });
    });
    return json({ ok: true, ...result });
  } catch (e) {
    return failure(e);
  }
}
