import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import { assertSameOrigin } from "./guard";
import { runtime, readSession, json, failure } from "./index";
import type { SessionPayload } from "./session";
import {
  coarsen, doneOut, onboardingOut, onboardingPut, permissionOut, permissionPut, permissionsOut, placeDelete, placeOut, placePut, placesOut,
  prefsOut, prefsPut, type PermissionPut, type PlaceDelete, type PlacePut,
} from "@/adapters/user-data-contract";
import type { FetchLike } from "./client";
import { guardedFetch } from "./resilience";

// BFF for the backend user-data store (ADR 0015). The backend token stays in the sealed cookie; bodies are allow-listed by zod
// before they leave; backend errors become coded, client-safe errors; values never appear in errors or logs.

export type UserDataClientOptions = { baseUrl: string; fetch?: FetchLike; timeoutMs?: number };

const KNOWN: Record<string, [number, AppError["code"], boolean]> = {
  REVISION_CONFLICT: [409, "REVISION_CONFLICT", false],
  LOCATION_PERMISSION_REQUIRED: [403, "LOCATION_PERMISSION_REQUIRED", false],
  USER_DATA_RATE_LIMITED: [429, "RATE_LIMITED", true],
  PAYLOAD_TOO_LARGE: [400, "INVALID_INPUT", false],
  INVALID_REQUEST: [400, "INVALID_INPUT", false],
  PLACE_NOT_FOUND: [404, "NOT_FOUND", false],
  MEMBER_NOT_FOUND: [404, "NOT_FOUND", false],
  HOUSEHOLD_WRITE_FORBIDDEN: [403, "FORBIDDEN", false],
  MEMBER_PROTECTED: [403, "FORBIDDEN", false],
  USER_DATA_HOUSEHOLD_MISMATCH: [409, "REVISION_CONFLICT", false],
};

function backendCode(body: unknown): string | null {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === "string" ? code : null;
}

/** Maps a failed backend answer to a coded error. Only the code and status are read; the message is never forwarded. */
export function mapFailure(status: number, body: unknown): AppError {
  const known = KNOWN[backendCode(body) ?? ""];
  if (known) return new AppError(known[0], known[1], known[2]);
  if (status === 401 || status === 403) return new AppError(401, "UNAUTHENTICATED");
  if (status === 429) return new AppError(429, "RATE_LIMITED", true);
  if (status === 400 || status === 413 || status === 422) return new AppError(400, "INVALID_INPUT");
  if (status === 404) return new AppError(404, "NOT_FOUND");
  if (status >= 500) return new AppError(502, "BACKEND_UNREACHABLE", true);
  return new AppError(502, "BACKEND_REJECTED");
}

export function createUserDataClient(opts: UserDataClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = opts.fetch ?? guardedFetch;
  const timeoutMs = opts.timeoutMs ?? 5000;

  async function send(method: "GET" | "PUT" | "DELETE", path: string, token: string, o: { json?: unknown; revision?: number } = {}): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}` };
    if (o.json !== undefined) headers["content-type"] = "application/json";
    if (o.revision !== undefined) headers["if-match"] = String(o.revision);
    try {
      const res = await doFetch(`${base}${path}`, { method, headers, body: o.json === undefined ? undefined : JSON.stringify(o.json), signal: controller.signal, cache: "no-store", redirect: "error" });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        if (res.ok) throw new AppError(502, "BACKEND_BAD_RESPONSE");
      }
      if (res.status < 200 || res.status >= 300) throw mapFailure(res.status, parsed);
      return parsed;
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (controller.signal.aborted) throw new AppError(504, "BACKEND_TIMEOUT", true);
      throw new AppError(503, "BACKEND_UNREACHABLE", true);
    } finally {
      clearTimeout(timer);
    }
  }

  const parse = <T>(schema: z.ZodType<T>, v: unknown): T => {
    const r = schema.safeParse(v);
    if (!r.success) throw new AppError(502, "BACKEND_BAD_RESPONSE");
    return r.data;
  };
  const hp = (h: string) => `/api/v1/households/${encodeURIComponent(h)}`;
  const withOk = (v: unknown) => ({ ...(v as object), ok: true as const });
  // The backend reports completedAt (a timestamp or null); the app only needs whether it is set.
  const onboardingView = (v: unknown) => {
    const r = (v ?? {}) as { state?: unknown; completedAt?: unknown; revision?: unknown };
    return { ok: true, state: r.state ?? null, completed: Boolean(r.completedAt), revision: r.revision };
  };

  return {
    async listPermissions(token: string, h: string) {
      return parse(permissionsOut, withOk(await send("GET", `${hp(h)}/permissions`, token)));
    },
    async setPermission(token: string, h: string, b: PermissionPut) {
      const { permission, revision, ...body } = b;
      const row = await send("PUT", `${hp(h)}/permissions/${permission}`, token, { json: body, revision });
      return parse(permissionOut, { ok: true, permission: row });
    },
    async listPlaces(token: string, h: string) {
      return parse(placesOut, withOk(await send("GET", `${hp(h)}/places`, token)));
    },
    async setPlace(token: string, h: string, b: PlacePut) {
      const { kind, revision } = b;
      let body: Record<string, unknown>;
      if (b.kind === "current_location") {
        // Round before sending unless this is the Emergency surface asking for the exact position.
        const location = b.precision === "exact" ? b.location : coarsen(b.location);
        body = { location, precision: b.precision, surface: b.surface };
      } else if (b.kind === "saved_place") {
        body = { address: b.address, label: b.label, slot: b.slot };
      } else {
        body = { address: b.address, source: b.source };
      }
      const row = await send("PUT", `${hp(h)}/places/${kind}`, token, { json: body, revision });
      return parse(placeOut, { ok: true, place: row });
    },
    async deletePlace(token: string, h: string, b: PlaceDelete) {
      const q = b.slot ? `?slot=${b.slot}` : "";
      await send("DELETE", `${hp(h)}/places/${b.kind}${q}`, token, { revision: b.revision });
      return parse(doneOut, { ok: true });
    },
    async getPreferences(token: string, h: string) {
      return parse(prefsOut, withOk(await send("GET", `${hp(h)}/preferences`, token)));
    },
    async setPreferences(token: string, h: string, b: z.infer<typeof prefsPut>) {
      return parse(prefsOut, withOk(await send("PUT", `${hp(h)}/preferences`, token, { json: { prefs: b.prefs }, revision: b.revision })));
    },
    async getOnboarding(token: string, h: string) {
      return parse(onboardingOut, onboardingView(await send("GET", `${hp(h)}/onboarding`, token)));
    },
    async setOnboarding(token: string, h: string, b: z.infer<typeof onboardingPut>) {
      const res = await send("PUT", `${hp(h)}/onboarding`, token, { json: { state: b.state, completed: b.completed }, revision: b.revision });
      return parse(onboardingOut, onboardingView(res));
    },
  };
}
export type UserDataClient = ReturnType<typeof createUserDataClient>;

export type RouteCtx = { req: Request; client: UserDataClient; session: SessionPayload };

/** Wraps a handler with the same-origin rule, the sealed session and coded error output. */
export function userDataRoute(handler: (ctx: RouteCtx) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const { config } = runtime();
      const session = await readSession(config.cookieSecret);
      if (!session) throw new AppError(401, "UNAUTHENTICATED");
      const client = createUserDataClient({ baseUrl: config.apiUrl });
      return json(await handler({ req, client, session }));
    } catch (e) {
      return failure(e);
    }
  };
}

/** Parses a JSON body against an allow-list. Anything else is a coded INVALID_INPUT with no echo of the value. */
export async function readBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = await req.json().catch(() => null);
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError(400, "INVALID_INPUT");
  return r.data;
}

export function readQuery<T>(req: Request, schema: z.ZodType<T>): T {
  const url = new URL(req.url);
  const rev = url.searchParams.get("revision");
  const raw = {
    kind: url.searchParams.get("kind") ?? undefined,
    slot: url.searchParams.get("slot") ?? undefined,
    revision: rev === null ? undefined : Number(rev),
  };
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError(400, "INVALID_INPUT");
  return r.data;
}

export const schemas = { permissionPut, placePut, placeDelete, prefsPut, onboardingPut };
