import { AdapterError, type ChatAdapter } from "./types";
import { answerEvent, deltaEvent, errorEvent, metaEvent, threadIn, type TurnEvent } from "./chat-contract";
import { coverOut } from "./covers-contract";
import { consentOut } from "./documents-contract";
import type { z } from "zod";

// Browser client for the same-origin chat BFF (/api/app/chat/threads). It reads the streamed turn (text/event-stream) and hands each
// event to the page. It never sees the backend token or the backend. Every event is parsed again here, so a malformed frame is an error,
// not a half-drawn answer.

const HEADERS = { "x-knowvia-app": "1" };

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
    let res: Response;
    try {
      res = await fetch(`/api/app/chat/threads/${encodeURIComponent(threadId)}/turns`, { method: "POST", cache: "no-store", headers: { ...HEADERS, "content-type": "application/json", accept: "text/event-stream" }, body: JSON.stringify(input), signal });
    } catch (e) {
      if (signal?.aborted) return;
      void e;
      throw new AdapterError("BACKEND_UNREACHABLE", true);
    }
    if (!res.ok) throw await failedWith(res);
    if (!(res.headers.get("content-type") ?? "").toLowerCase().startsWith("text/event-stream") || !res.body) throw new AdapterError("BACKEND_BAD_RESPONSE");
    const reader = res.body.getReader();
    const text = new TextDecoder();
    let buf = "";
    let finished = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
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
      throw new AdapterError("CHAT_STREAM_FAILED", true);
    } finally {
      reader.cancel().catch(() => undefined);
    }
    if (!finished && !signal?.aborted) throw new AdapterError("CHAT_STREAM_FAILED", true);
  },
};
