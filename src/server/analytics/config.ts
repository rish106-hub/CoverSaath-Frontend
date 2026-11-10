import "server-only";

/**
 * Analytics configuration. Names only; values live in the host environment (docs/analytics.md).
 *  ANALYTICS_ENABLED   "1" switches the proxy on. Anything else (or unset) is off.
 *  POSTHOG_PROJECT_KEY  project ingestion key, server side only.
 *  POSTHOG_HOST         one of POSTHOG_HOSTS below (EU cloud first).
 */
export const POSTHOG_HOSTS = ["https://eu.i.posthog.com", "https://us.i.posthog.com"] as const;

export type AnalyticsConfig = { key: string; host: string };

/** Null when the flag is off or the config is incomplete or unsafe. Fails closed. */
export function analyticsConfig(env: Record<string, string | undefined> = process.env): AnalyticsConfig | null {
  if (env.ANALYTICS_ENABLED !== "1") return null;
  const key = env.POSTHOG_PROJECT_KEY?.trim();
  const host = env.POSTHOG_HOST?.trim().replace(/\/+$/, "");
  if (!key || !host || !(POSTHOG_HOSTS as readonly string[]).includes(host)) return null;
  return { key, host };
}
