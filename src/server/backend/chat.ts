import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import { guardedFetch } from "./resilience";
import { mapFailure } from "./user-data";
import { answerSourceSchema, answerStatusSchema } from "@/adapters/schemas";
import type { FetchLike } from "./client";

// BFF client for the backend chat route (P7a): POST /api/v1/households/:id/chat. Chat v0 is deterministic and cited. The backend
// token stays server-side. The message is never logged and never echoed in errors.

export const CHAT_TIMEOUT_MS = 15_000;
export const chatBody = z.object({ text: z.string().trim().min(1).max(500), page: z.string().regex(/^\/[a-z0-9/_-]{0,64}$/).optional() });
export type ChatBody = z.infer<typeof chatBody>;

/** Allow-list of what the backend may send to the browser. Steps may be short or long here; the browser adapter normalises to three. */
const chatOut = z.object({
  reply: z.string().max(4000),
  steps: z.array(z.string().max(300)).max(6).optional(),
  route: z.string().max(200).optional(),
  goLabel: z.string().max(100).optional(),
  pageRef: z.string().max(200).optional(),
  answerStatus: answerStatusSchema.optional(),
  sources: z.array(answerSourceSchema).max(10).optional(),
});
export type ChatOut = z.infer<typeof chatOut>;

const CHAT_CODES = new Set(["CHAT_NOT_CONFIGURED", "READBACK_DISABLED"]);
const code = (b: unknown): string | null => {
  const c = (b as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof c === "string" ? c : null;
};

export function createChatClient(opts: { baseUrl: string; fetch?: FetchLike; timeoutMs?: number }) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = opts.fetch ?? guardedFetch;
  const timeoutMs = opts.timeoutMs ?? CHAT_TIMEOUT_MS;
  return {
    async ask(token: string, householdId: string, body: ChatBody): Promise<ChatOut> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(`${base}/api/v1/households/${encodeURIComponent(householdId)}/chat`, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: body.text, ...(body.page ? { page: body.page } : {}) }),
          signal: controller.signal, cache: "no-store", redirect: "error",
        });
        const text = await res.text();
        let parsed: unknown = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { if (res.ok) throw new AppError(502, "BACKEND_BAD_RESPONSE"); }
        if (res.status < 200 || res.status >= 300) {
          if (res.status === 503 && CHAT_CODES.has(code(parsed) ?? "")) throw new AppError(503, "CHAT_NOT_CONFIGURED");
          throw mapFailure(res.status, parsed);
        }
        const r = chatOut.safeParse(parsed);
        if (!r.success) throw new AppError(502, "BACKEND_BAD_RESPONSE");
        return r.data;
      } catch (e) {
        if (e instanceof AppError) throw e;
        if (controller.signal.aborted) throw new AppError(504, "BACKEND_TIMEOUT", true);
        throw new AppError(503, "BACKEND_UNREACHABLE", true);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
