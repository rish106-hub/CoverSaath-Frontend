import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import { guardedFetch } from "./resilience";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type ClientOptions = { baseUrl: string; bootstrapToken: string; identityToken?: string; fetch?: FetchLike; timeoutMs?: number };

const sessionSchema = z.object({ token: z.string().min(16), sessionId: z.string(), adultUserId: z.string(), expiresAt: z.string() });
const createSchema = z.object({
  household: z.object({ id: z.string(), display_name: z.string().optional() }).loose(),
  owner: z.object({ id: z.string(), display_name: z.string().optional() }).loose(),
  ownerMember: z.object({ id: z.string() }).loose(),
  session: sessionSchema,
});
const matrixSchema = z.object({
  household: z.object({ id: z.string(), display_name: z.string().optional() }).loose(),
  viewerRole: z.string().optional(),
  members: z.array(z.object({ id: z.string(), displayName: z.string(), memberKind: z.string().nullish(), relationshipLabel: z.string().nullish() }).loose()),
}).loose();

const identitySchema = z.object({
  returning: z.boolean(),
  household: z.object({ id: z.string() }).loose(),
  memberId: z.string(),
  session: z.object({ token: z.string().min(16), expiresAt: z.string() }).loose(),
}).loose();

export type SignedIn = { returning: boolean; householdId: string; memberId: string; token: string; expiresAt: string };
export type CreatedHousehold = { householdId: string; ownerMemberId: string; adultUserId: string; token: string; expiresAt: string };
export type HouseholdView = z.infer<typeof matrixSchema>;

/** Typed backend client. 5 s timeout, coded errors, tokens never logged. */
export function createBackendClient(opts: ClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = opts.fetch ?? guardedFetch;
  const timeoutMs = opts.timeoutMs ?? 5000;

  async function send(method: "GET" | "POST", path: string, o: { token?: string; bootstrap?: boolean; identity?: boolean; json?: unknown } = {}): Promise<{ status: number; body: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { accept: "application/json" };
    if (o.bootstrap) headers.authorization = `Bearer ${opts.bootstrapToken}`;
    else if (o.identity) headers.authorization = `Bearer ${opts.identityToken ?? ""}`;
    else if (o.token) headers.authorization = `Bearer ${o.token}`;
    let body: string | undefined;
    if (o.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(o.json);
    }
    try {
      const res = await doFetch(`${base}${path}`, { method, headers, body, signal: controller.signal, cache: "no-store", redirect: "error" });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        if (res.ok) throw new AppError(502, "BACKEND_BAD_RESPONSE");
      }
      return { status: res.status, body: parsed };
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (controller.signal.aborted) throw new AppError(504, "BACKEND_TIMEOUT", true);
      throw new AppError(503, "BACKEND_UNREACHABLE", true);
    } finally {
      clearTimeout(timer);
    }
  }

  function ok(r: { status: number; body: unknown }, authed: boolean): unknown {
    if (r.status >= 200 && r.status < 300) return r.body;
    if (authed && (r.status === 401 || r.status === 403)) throw new AppError(401, "UNAUTHENTICATED");
    if (r.status === 400 || r.status === 422) throw new AppError(400, "INVALID_INPUT");
    if (r.status >= 500) throw new AppError(502, "BACKEND_UNREACHABLE", true);
    throw new AppError(502, "BACKEND_REJECTED");
  }

  function parse<T>(schema: z.ZodType<T>, v: unknown): T {
    const r = schema.safeParse(v);
    if (!r.success) throw new AppError(502, "BACKEND_BAD_RESPONSE");
    return r.data;
  }

  return {
    /** Health never throws on a 503 from /ready: not-ready is an answer. */
    async health(): Promise<boolean> {
      const r = await send("GET", "/api/v1/health");
      return r.status === 200;
    },
    async ready(): Promise<boolean> {
      const r = await send("GET", "/api/v1/ready");
      return r.status === 200;
    },
    async createHousehold(input: { name: string; email: string }): Promise<CreatedHousehold> {
      const r = await send("POST", "/api/v1/households", {
        bootstrap: true,
        json: { displayName: `${input.name.split(" ").slice(-1)[0]} family`, owner: { displayName: input.name, contactEmail: input.email, locale: "en-IN" } },
      });
      if (r.status === 401 || r.status === 403) throw new AppError(503, "CONFIG_MISSING");
      const d = parse(createSchema, ok(r, false));
      return { householdId: d.household.id, ownerMemberId: d.ownerMember.id, adultUserId: d.session.adultUserId, token: d.session.token, expiresAt: d.session.expiresAt };
    },
    /** Sign-in identity (ADR 0012 D3): the backend maps (issuer, subject) to one adult and starts a session. */
    async identitySession(input: { issuer: string; subject: string; displayName: string; contactEmail: string | null }): Promise<SignedIn> {
      if (!opts.identityToken) throw new AppError(503, "CONFIG_MISSING");
      const r = await send("POST", "/api/v1/identity-sessions", { identity: true, json: input });
      if (r.status === 503) throw new AppError(503, "CONFIG_MISSING");
      if (r.status === 401 || r.status === 403) throw new AppError(401, "UNAUTHENTICATED");
      if (r.status === 429) throw new AppError(429, "RATE_LIMITED", true);
      const d = parse(identitySchema, ok(r, false));
      return { returning: d.returning, householdId: d.household.id, memberId: d.memberId, token: d.session.token, expiresAt: d.session.expiresAt };
    },
    async household(token: string, id: string): Promise<HouseholdView> {
      return parse(matrixSchema, ok(await send("GET", `/api/v1/households/${encodeURIComponent(id)}`, { token }), true));
    },
    async integrations(token: string): Promise<unknown> {
      return ok(await send("GET", "/api/v1/integrations", { token }), true);
    },
    async revoke(token: string): Promise<void> {
      await send("POST", "/api/v1/sessions/current/revoke", { token });
    },
  };
}
export type BackendClient = ReturnType<typeof createBackendClient>;
