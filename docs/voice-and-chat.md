# Chat and voice (STT) runbook

## Chat
`/api/app/chat` proxies to the CoverSaath API `POST /api/v1/households/:id/chat` with the sealed session token (15 s timeout). Demo sessions are refused (403 `DEMO_READ_ONLY`) and the browser keeps the mock assistant. If the backend has chat off it answers 503 `CHAT_NOT_CONFIGURED` and the app shows "Chat is not switched on yet." Owner action: set `CHAT_ENABLED=true` (and `DOCUMENT_READBACK_ENABLED=true`) on the API host, then redeploy the API.

## Voice (speech to text only)
Browser records the microphone, encodes 16 kHz mono 16-bit WAV (max 30 s) and posts it to `/api/app/voice/transcribe`. The route calls Gnani Vachana `POST https://api.vachana.ai/stt/v3` (model `prisma-v3.0`) server-side. The browser never calls Gnani (CSP stays `'self'`).

Owner action (the agent that built this never touches envs). Voice through Gnani is OFF by default (spend gate):
1. Vercel project > Settings > Environment Variables > add `GNANI_API_KEY` (server env var, never `NEXT_PUBLIC_`) AND `GNANI_STT_ENABLED=true` (exactly `true`), for the environments you want.
2. Redeploy. Env changes apply only to new deployments.
3. If either is missing the route answers 503 `VOICE_NOT_CONFIGURED` and the app falls back to browser speech (see below).

Spend and abuse limits (BFF, `src/server/backend/gnani.ts`):
- Per household, best effort: `GNANI_STT_PER_HOUR` (default 20) and `GNANI_STT_PER_DAY` (default 100) clips; over the limit is 429 `VOICE_RATE_LIMITED`. Only valid clips count.
- The limiter is IN MEMORY. Serverless instances do not share memory, so the real ceiling is the limit times the number of warm instances. OWNER DECISION: a shared store (Redis, the database) would make it exact; none is added here.
- One clip at a time per session (429 `VOICE_BUSY`, also Gnani's own 429).
- Body caps: the transcribe route needs `Content-Length` (411 if missing or not a number, 413 `VOICE_TOO_LARGE` over 2 MB) and reads the stream with a byte counter that aborts at 2 MB. The chat route needs `application/json` (415) and a `Content-Length` of at most 4 KB (413).

Gnani answers: 422 (clip unreadable) becomes 400 `VOICE_BAD_AUDIO` and the browser does NOT fall back to browser speech for it. 401/402/403/504 and other failures become 502 `VOICE_UPSTREAM_FAILED`; the server logs one line, `{"event":"VOICE_UPSTREAM_STATUS","status":<code>}`, with no body, audio, transcript or key, so a bad key or no credit is visible in the logs. The response is `{ transcript, language?, truncated? }`: `language` is `detected_language_code` (fallbacks `language_code`, `language`); `truncated: true` means Gnani cut the clip short (the app does not act on it yet). Audio, transcripts and the key are never logged; upstream error bodies are never returned.

## Browser-speech fallback (who receives the audio)
If the BFF cannot be used (`VOICE_NOT_CONFIGURED`, a demo-session refusal or the network down) or the browser cannot capture audio, the app uses the browser's own speech recognition. In Chrome that sends the audio to Google; other browsers differ. So the fallback is never silent: the panel first shows "Your browser's speech service will be used instead. Tap the mic to continue." and starts only when the person taps again. Only `VOICE_NOT_CONFIGURED` makes the fallback stick for the rest of the session. Bad audio, busy, rate-limited and upstream errors are shown as they are and do not switch recipient.

## Microphone capture
The audio context is created inside the click or key handler (Safari) and resumed before capture, requested at 16 kHz. If the browser gives another rate the clip is low-pass filtered (box average) before decimation to 16 kHz; a context below 16 kHz is refused (`VOICE_RATE_UNSUPPORTED`). Letting go while the permission prompt is open releases the stream as soon as it resolves, and unmounting the panel stops capture.

FOR LEGAL REVIEW (none of this wording is final): "Audio is sent to a speech service to turn it into text." and "Your browser's speech service will be used instead." The old "It is not stored." was removed because Gnani retention terms are not in its docs. OWNER DECISION: get Gnani's retention terms before public launch.
