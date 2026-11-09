# Chat and voice (STT) runbook

## Chat
`/api/app/chat` proxies to the CoverSaath API `POST /api/v1/households/:id/chat` with the sealed session token (15 s timeout). Demo sessions are refused (403 `DEMO_READ_ONLY`) and the browser keeps the mock assistant. If the backend has chat off it answers 503 `CHAT_NOT_CONFIGURED` and the app shows "Chat is not switched on yet." Owner action: set `CHAT_ENABLED=true` (and `DOCUMENT_READBACK_ENABLED=true`) on the API host, then redeploy the API.

## Voice (speech to text only)
Browser records the microphone, encodes 16 kHz mono 16-bit WAV (max 30 s) and posts it to `/api/app/voice/transcribe`. The route calls Gnani Vachana `POST https://api.vachana.ai/stt/v3` (model `prisma-v3.0`) server-side. The browser never calls Gnani (CSP stays `'self'`).

Owner action (set the key; the agent that built this never touches envs):
1. Vercel project > Settings > Environment Variables > add `GNANI_API_KEY` (server env var, never prefix `NEXT_PUBLIC_`), for Production and Preview as wanted.
2. Redeploy. Env changes apply only to new deployments.
3. Without the key the route answers 503 `VOICE_NOT_CONFIGURED` and the app falls back to browser speech.

Limits and behaviour: one active Gnani request per account, so a second call while one runs gets 429 `VOICE_BUSY` (per-session lock here, plus Gnani's own 429). Upstream 401/402/403/504 become 502 `VOICE_UPSTREAM_FAILED`. Audio, transcripts and the key are never logged; upstream error bodies are never returned.

FOR LEGAL REVIEW: notice copy "Audio is sent to a speech service to turn it into text. It is not stored." Gnani retention terms are not in its docs; confirm before public launch.
