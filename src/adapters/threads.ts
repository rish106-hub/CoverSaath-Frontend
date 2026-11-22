import { AdapterError, type ChatAdapter } from "./types";
import { answerEvent, deltaEvent, errorEvent, metaEvent, threadIn, type TurnEvent } from "./chat-contract";
import { coverOut } from "./covers-contract";
import { consentOut } from "./documents-contract";
import type { z } from "zod";
import { TURN_IDLE_MS, TURN_WATCHDOG_MS } from "./chat-timing";

// Browser client for the same-origin chat BFF (/api/app/chat/threads). It reads the streamed turn (text/event-stream) and hands each
// event to the page. It never sees the backend token or the backend. Every event is parsed again here, so a malformed frame is an error,
// not a half-drawn answer.

const HEADERS = { "x-knowvia-app": "1" };

/** A turn never waits longer than TURN_WATCHDOG_MS in total, or TURN_IDLE_MS for the next bytes (chat-timing.ts). Past either the page shows "That took too long" and offers a retry. */
export { TURN_WATCHDOG_MS, TURN_IDLE_MS };

async function failedWith(res: Response): Promise<AdapterError> {
  const b = ((await res.json().catch(() => null)) ?? {}) as { code?: unknown; retryable?: unknown };
  return new AdapterError(typeof b.code === "string" ? b.code : res.status === 401 ? "UNAUTHENTICATED" : "BACKEND_UNREACHABLE", b.retryable === true || res.status >= 500);
}

const SCHEMAS: Record<string, z.ZodType | null> = { meta: metaEvent, delta: deltaEvent, answer: answerEvent, error: errorEvent, done: null };

function parseFrame(raw: string): TurnEvent | null {
  let name = "";
  const data: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!name) return null;
  if (!(name in SCHEMAS)) throw new AdapterError("CHAT_STREAM_FAILED");
  const schema = SCHEMAS[name];
  if (!schema) return { type: "done", data: {} };
  let value: unknown;
  try { value = JSON.parse(data.join("\n")); } catch { throw new AdapterError("CHAT_STREAM_FAILED"); }
  const r = schema.safeParse(value);
  if (!r.success) throw new AdapterError("CHAT_STREAM_FAILED");
  return { type: name, data: r.data } as TurnEvent;
}

async function consentCall(method: "GET" | "POST" | "DELETE", body?: unknown): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch("/api/app/chat/consent", { method, cache: "no-store", headers: { ...HEADERS, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new AdapterError("BACKEND_UNREACHABLE", true);
  }
  if (!res.ok) throw await failedWith(res);
  const r = consentOut.safeParse(await res.json().catch(() => null));
  if (!r.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return r.data.consent;
}

export const backendChat: ChatAdapter = {
  consent: () => consentCall("GET"),
  async grantConsent(requestId) { await consentCall("POST", { accept: true, requestId }); },
  async revokeConsent() { await consentCall("DELETE"); },
  async startThread(holdingId) {
    let res: Response;
    try {
      res = await fetch("/api/app/chat/threads", { method: "POST", cache: "no-store", headers: { ...HEADERS, "content-type": "application/json" }, body: JSON.stringify(holdingId ? { holdingId } : {}) });
    } catch {
      throw new AdapterError("BACKEND_UNREACHABLE", true);
    }
    if (!res.ok) throw await failedWith(res);
    const outer = coverOut.safeParse(await res.json().catch(() => null));
    const t = threadIn.safeParse(outer.success ? outer.data.data : null);
    if (!t.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
    return t.data;
  },

  async turn(threadId, input, onEvent, signal) {
    // The caller's signal and our own watchdog share one controller, so either can end the request and the read.
    const ctl = new AbortController();
    let timedOut = false;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const trip = () => { timedOut = true; ctl.abort(); };
    const total = setTimeout(trip, TURN_WATCHDOG_MS);
    const armIdle = () => { clearTimeout(idle); idle = setTimeout(trip, TURN_IDLE_MS); };
    const onCaller = () => ctl.abort();
    if (signal?.aborted) return;
    signal?.addEventListener("abort", onCaller, { once: true });
    armIdle();
    const stop = () => { clearTimeout(total); clearTimeout(idle); signal?.removeEventListener("abort", onCaller); };
    let res: Response;
    try {
      res = await fetch(`/api/app/chat/threads/${encodeURIComponent(threadId)}/turns`, { method: "POST", cache: "no-store", headers: { ...HEADERS, "content-type": "application/json", accept: "text/event-stream" }, body: JSON.stringify(input), signal: ctl.signal });
    } catch (e) {
      stop();
      if (signal?.aborted) return;
      void e;
      throw new AdapterError(timedOut ? "BACKEND_TIMEOUT" : "BACKEND_UNREACHABLE", true);
    }
    if (!res.ok) { stop(); throw await failedWith(res); }
    if (!(res.headers.get("content-type") ?? "").toLowerCase().startsWith("text/event-stream") || !res.body) { stop(); throw new AdapterError("BACKEND_BAD_RESPONSE"); }
    const reader = res.body.getReader();
    const text = new TextDecoder();
    let buf = "";
    let finished = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdle();
        buf += text.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let at = buf.indexOf("\n\n");
        while (at >= 0) {
          const ev = parseFrame(buf.slice(0, at));
          buf = buf.slice(at + 2);
          if (ev?.type === "error") throw new AdapterError(ev.data.code, true);
          if (ev) onEvent(ev);
          if (ev?.type === "done") finished = true;
          at = buf.indexOf("\n\n");
        }
      }
    } catch (e) {
      if (signal?.aborted) return;
      if (e instanceof AdapterError) throw e;
      throw new AdapterError(timedOut ? "BACKEND_TIMEOUT" : "CHAT_STREAM_FAILED", true);
    } finally {
      stop();
      reader.cancel().catch(() => undefined);
    }
    if (!finished && !signal?.aborted) throw new AdapterError(timedOut ? "BACKEND_TIMEOUT" : "CHAT_STREAM_FAILED", true);
  },
};
