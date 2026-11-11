import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import { mapDocFailure, need, type Ctx } from "./documents";
import { guardedFetch } from "./resilience";
import { runtime } from "./index";
import { answerEvent, deltaEvent, errorEvent, hospitalsIn, metaEvent, threadIn, type TurnInput } from "@/adapters/chat-contract";
import { containsUin } from "@/adapters/covers-contract";

// BFF for chat threads, streamed turns and hospitals (CoverSaath chat v1, PR #102). Server only. The backend token stays in the sealed
// session cookie. The turn stream passes through on the Node runtime, but every event is parsed against an allow-list first: a field the
// contract does not name is dropped, an event that fails the contract ends the stream with one coded `error` event, and a body that
// looks like it holds a UIN is refused. The message is never logged and never echoed in an error.

const enc = encodeURIComponent;
export const TURN_TIMEOUT_MS = 55_000;
/** Largest single SSE frame (or unfinished tail) read from the backend. Larger means a broken or hostile upstream. */
const MAX_FRAME = 64 * 1024;
const out = (data: unknown): { data: unknown } => ({ data });

export async function createThread(ctx: Ctx, holdingId: string | null): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("POST", "/api/v1/chat/threads", ctx.session.t, { json: { household_id: ctx.session.h, ...(holdingId ? { holding_id: holdingId } : {}) } });
  const t = (r.body as { thread?: unknown } | null)?.thread as { id?: unknown; holding_id?: unknown } | undefined;
  const p = threadIn.safeParse({ id: t?.id, holdingId: t?.holding_id ?? null });
  if (!p.success) throw new AppError(502, "BACKEND_BAD_RESPONSE");
  return out(p.data);
}

/** Hospitals in the holding's network for one pincode. BACKEND ROUTE PENDING (S-C2): until it exists the backend answers 404 and the page shows a coded error. */
export async function listHospitals(ctx: Ctx, holdingId: string, pincode: string): Promise<{ data: unknown }> {
  need(ctx.session);
  const r = await ctx.client.send("GET", `/api/v1/holdings/${enc(holdingId)}/hospitals?pincode=${enc(pincode)}`, ctx.session.t);
  const p = hospitalsIn.safeParse(r.body);
  if (!p.success || containsUin(p.data)) throw new AppError(502, "BACKEND_BAD_RESPONSE");
  return out(p.data);
}

const frame = (event: string, data: unknown): string => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const snake = (o: unknown): unknown => {
  if (Array.isArray(o)) return o.map(snake);
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase()), snake(v)]));
  return o;
};

const SCHEMAS: Record<string, z.ZodType | null> = { meta: metaEvent, delta: deltaEvent, answer: answerEvent, error: errorEvent, done: null };

/** Parses backend SSE frames and re-emits only allow-listed, camelCased events. Exported for tests. */
export function sanitiseSse(): TransformStream<string, string> {
  let buf = "";
  let ended = false;
  const bad = (c: TransformStreamDefaultController<string>) => {
    ended = true;
    c.enqueue(frame("error", { code: "CHAT_STREAM_FAILED" }));
    c.terminate();
  };
  const one = (raw: string, c: TransformStreamDefaultController<string>) => {
    let name = "";
    const data: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) name = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (!name && data.length === 0) return; // comment or keep-alive
    if (!(name in SCHEMAS)) return bad(c);
    const schema = SCHEMAS[name];
    let payload: unknown = {};
    if (schema) {
      let parsed: unknown;
      try { parsed = JSON.parse(data.join("\n")); } catch { return bad(c); }
      const r = schema.safeParse(snake(parsed));
      if (!r.success || containsUin(r.data)) return bad(c);
      payload = r.data;
    }
    c.enqueue(frame(name, payload));
    if (name === "error" || name === "done") {
      ended = true;
      c.terminate();
    }
  };
  return new TransformStream<string, string>({
    transform(chunk, c) {
      if (ended) return;
      buf += chunk.replace(/\r\n/g, "\n");
      let at = buf.indexOf("\n\n");
      while (at >= 0 && !ended) {
        one(buf.slice(0, at), c);
        buf = buf.slice(at + 2);
        at = buf.indexOf("\n\n");
      }
      if (!ended && buf.length > MAX_FRAME) bad(c);
    },
    flush(c) {
      // The backend closed without `done`: tell the page the answer is incomplete rather than leaving it hanging.
      if (!ended) c.enqueue(frame("error", { code: "CHAT_STREAM_FAILED" }));
    },
  });
}

/** Opens a turn on the backend and returns its stream, sanitised. Failures before the stream opens are ordinary coded errors. */
export async function streamTurn(ctx: Ctx, threadId: string, turn: TurnInput & { inputKind: "text" | "voice" }): Promise<Response> {
  need(ctx.session);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);
  const body = {
    message: turn.message,
    input_kind: turn.inputKind,
    ...(turn.procedure ? { procedure: { planned_date: turn.procedure.plannedDate, estimated_cost_inr: turn.procedure.estimatedCostInr, room_rent_per_day_inr: turn.procedure.roomRentPerDayInr, stay_days: turn.procedure.stayDays } } : {}),
  };
  let res: Response;
  try {
    res = await guardedFetch(`${runtime().config.apiUrl.replace(/\/+$/, "")}/api/v1/chat/threads/${enc(threadId)}/turns`, {
      method: "POST",
      headers: { accept: "text/event-stream", "content-type": "application/json", authorization: `Bearer ${ctx.session.t}` },
      body: JSON.stringify(body), signal: controller.signal, cache: "no-store", redirect: "error",
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof AppError) throw e;
    throw controller.signal.aborted ? new AppError(504, "BACKEND_TIMEOUT", true) : new AppError(503, "BACKEND_UNREACHABLE", true);
  }
  if (!res.ok || !(res.headers.get("content-type") ?? "").toLowerCase().startsWith("text/event-stream") || !res.body) {
    clearTimeout(timer);
    let parsed: unknown = null;
    try { parsed = await res.json(); } catch { /* not JSON */ }
    if (res.ok) throw new AppError(502, "BACKEND_BAD_RESPONSE");
    throw mapDocFailure(res.status, parsed, true);
  }
  const stream = res.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(sanitiseSse())
    .pipeThrough(new TextEncoderStream());
  // The timer ends the upstream read if the turn runs past its budget; the page then sees the stream end without `done` and shows a coded error.
  const reader = stream.getReader();
  const body2 = new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        const { done, value } = await reader.read();
        if (done) { clearTimeout(timer); c.close(); } else c.enqueue(value);
      } catch {
        clearTimeout(timer);
        c.close();
      }
    },
    cancel() {
      clearTimeout(timer);
      controller.abort();
      return reader.cancel().catch(() => undefined);
    },
  });
  return new Response(body2, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", "x-content-type-options": "nosniff", "x-accel-buffering": "no" } });
}
