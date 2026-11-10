import "server-only";
import { AppError } from "./errors";

export type ServerConfig = { apiUrl: string; bootstrapToken: string; cookieSecret: string };

export const REQUIRED_ENV = ["KNOWVIA_API_URL", "KNOWVIA_BOOTSTRAP_TOKEN", "SESSION_COOKIE_SECRET"] as const;

export function missingEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_ENV.filter((k) => !env[k] || (k === "SESSION_COOKIE_SECRET" && (env[k] as string).length < 32));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  if (missingEnv(env).length > 0) throw new AppError(503, "CONFIG_MISSING");
  return {
    apiUrl: (env.KNOWVIA_API_URL as string).replace(/\/+$/, ""),
    bootstrapToken: env.KNOWVIA_BOOTSTRAP_TOKEN as string,
    cookieSecret: env.SESSION_COOKIE_SECRET as string,
  };
}

/**
 * Previous session secret, accepted for reading only during a rotation window. Ignored unless it is at least as strong as
 * the current one and different from it. Sessions are always re-sealed with the current secret.
 */
export function previousCookieSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const prev = env.SESSION_COOKIE_SECRET_PREVIOUS;
  if (!prev || prev.length < 32 || prev === env.SESSION_COOKIE_SECRET) return null;
  return prev;
}

/** Kid-less cookies (sealed before rotation existed) are accepted with the current key until SESSION_COOKIE_ACCEPT_LEGACY=0. */
export function acceptLegacyCookies(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SESSION_COOKIE_ACCEPT_LEGACY !== "0";
}
