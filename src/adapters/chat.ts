import type { AssistantAdapter } from "./types";
import { AdapterError } from "./types";
import { assistantReplySchema, type AssistantReply } from "./schemas";
import { pageFor } from "@/lib/ia";
import { z } from "zod";

// Browser client for the same-origin BFF chat route (/api/app/chat). The backend answers from stored evidence only (chat v0), so the
// reply carries answerStatus and sources. The browser never sees the backend token.

const wire = z.object({
  ok: z.literal(true).optional(),
  reply: z.string(),
  steps: z.array(z.string()).optional(),
  route: z.string().optional(),
  goLabel: z.string().optional(),
  pageRef: z.string().optional(),
  answerStatus: assistantReplySchema.shape.answerStatus,
  sources: assistantReplySchema.shape.sources,
}).loose();

const FALLBACK_STEPS = ["Read your question", "Looked in your documents", "Answer ready"] as const;

/** Always exactly three steps: keep up to three from the backend, fill the rest with plain defaults. */
export function normaliseSteps(steps: readonly string[] | undefined): [string, string, string] {
  const have = (steps ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  return [have[0] ?? FALLBACK_STEPS[0], have[1] ?? FALLBACK_STEPS[1], have[2] ?? FALLBACK_STEPS[2]];
}

/** A route is kept only if it is a known in-app page. Anything else (external, unknown, protocol-relative) is dropped. */
export function knownRoute(route: string | undefined): string | undefined {
  if (!route || !route.startsWith("/") || route.startsWith("//") || route.includes("\\")) return undefined;
  const path = route.split(/[?#]/)[0] ?? "";
  return pageFor(path) ? route : undefined;
}

export const backendAssistant: AssistantAdapter = {
  async ask(text, page) {
    let res: Response;
    try {
      res = await fetch("/api/app/chat", {
        method: "POST", cache: "no-store",
        headers: { "content-type": "application/json", "x-knowvia-app": "1" },
        body: JSON.stringify({ text, page: /^\/[a-z0-9/_-]{0,64}$/.test(page) ? page : undefined }),
      });
    } catch {
      throw new AdapterError("BACKEND_UNREACHABLE", true);
    }
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const b = body as { code?: unknown; retryable?: unknown };
      throw new AdapterError(typeof b.code === "string" ? b.code : "BACKEND_UNREACHABLE", b.retryable === true);
    }
    const p = wire.safeParse(body);
    if (!p.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
    const d = p.data;
    const route = knownRoute(d.route);
    const reply: AssistantReply = {
      reply: d.reply,
      steps: normaliseSteps(d.steps),
      ...(route ? { route, ...(d.goLabel ? { goLabel: d.goLabel } : {}) } : {}),
      ...(d.pageRef ? { pageRef: d.pageRef } : {}),
      ...(d.answerStatus ? { answerStatus: d.answerStatus } : {}),
      ...(d.sources ? { sources: d.sources } : {}),
    };
    return assistantReplySchema.parse(reply);
  },
};
