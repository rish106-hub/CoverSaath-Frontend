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
