import "server-only";
import { cookies } from "next/headers";
import { createBackendClient, type BackendClient } from "./client";
import { loadConfig, type ServerConfig } from "./env";
import { COOKIE_NAME, open, seal, type SessionPayload } from "./session";
import { AppError, errorBody } from "./errors";

export { AppError, errorBody };

export function runtime(): { config: ServerConfig; client: BackendClient } {
  const config = loadConfig();
  return { config, client: createBackendClient({ baseUrl: config.apiUrl, bootstrapToken: config.bootstrapToken }) };
}

export async function readSession(secret: string): Promise<SessionPayload | null> {
  return open((await cookies()).get(COOKIE_NAME)?.value, secret);
}

export async function writeSession(payload: SessionPayload, secret: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, seal(payload, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(60, Math.floor((payload.exp - Date.now()) / 1000)),
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function failure(e: unknown): Response {
  const err = e instanceof AppError ? e : new AppError(500, "BACKEND_UNREACHABLE", true);
  return Response.json(errorBody(err), { status: err.status, headers: retryHeaders(err) });
}

/** no-store always; Retry-After when the error carries one (overload or open circuit). */
export function retryHeaders(err: { retryAfter?: number }): Record<string, string> {
  const h: Record<string, string> = { "cache-control": "no-store" };
  if (err.retryAfter !== undefined) h["retry-after"] = String(err.retryAfter);
  return h;
}
