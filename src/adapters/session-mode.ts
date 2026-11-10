import { isDemoSession } from "./demo";
// Which adapter set serves this browser: the demo (mock) set for the one demo session, the real set for everyone else.
// Decided per session, from what the BFF says about the sealed cookie, never from a build flag. Unknown or failed lookups
// resolve to "real" (and are not cached) so mock data can only appear after the server has said "demo".

export type SessionMode = "demo" | "real";

let known: SessionMode | null = null;
let inflight: Promise<SessionMode> | null = null;

export function setSessionMode(mode: SessionMode): void {
  known = mode;
}
export function resetSessionMode(): void {
  known = null;
  inflight = null;
}
/** The BFF names the demo session `mock` (source) with `demo: true`; `demo` is accepted too. */
export const modeFromSource = (source: unknown): SessionMode => (source === "demo" || source === "mock" ? "demo" : "real");

export function resolveSessionMode(): Promise<SessionMode> {
  if (known) return Promise.resolve(known);
  // The kv_demo marker is set only by the server, from a sealed demo session, and cleared on any other sign-in. It only picks the mock set; every backend route still refuses a demo session.
  if (isDemoSession()) return Promise.resolve("demo");
  inflight ??= fetch("/api/app/me", { cache: "no-store", headers: { "x-knowvia-app": "1" } })
    .then(async (res) => {
      if (!res.ok) return "real" as const;
      const body = (await res.json().catch(() => null)) as { source?: unknown } | null;
      const mode = modeFromSource(body?.source);
      known = mode;
      return mode;
    })
    .catch(() => "real" as const)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
