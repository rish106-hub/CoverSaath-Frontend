/**
 * fetch with bounded retry for safe reads. Retries only GET/HEAD, only on a network error or 502/503/504,
 * at most `retries` times, waiting for the server's Retry-After (capped) or exponential backoff with jitter.
 * Writes are never retried here: a repeated write needs its own idempotency key.
 */
export type RetryOptions = {
  retries?: number;
  baseMs?: number;
  maxWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const RETRYABLE = new Set([502, 503, 504]);

export function retryDelayMs(attempt: number, retryAfter: string | null, o: Required<Pick<RetryOptions, "baseMs" | "maxWaitMs" | "random">>): number {
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, o.maxWaitMs);
  return Math.min(o.baseMs * 2 ** attempt * (0.75 + o.random() * 0.5), o.maxWaitMs);
}

export async function fetchWithRetry(input: string, init: RequestInit = {}, opts: RetryOptions = {}): Promise<Response> {
  const retries = opts.retries ?? 2;
  const baseMs = opts.baseMs ?? 400;
  const maxWaitMs = opts.maxWaitMs ?? 3000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;
  const method = (init.method ?? "GET").toUpperCase();
  const safe = method === "GET" || method === "HEAD";

  for (let attempt = 0; ; attempt += 1) {
    const last = !safe || attempt >= retries;
    try {
      const res = await fetch(input, init);
      if (last || !RETRYABLE.has(res.status)) return res;
      await sleep(retryDelayMs(attempt, res.headers.get("retry-after"), { baseMs, maxWaitMs, random }));
    } catch (e) {
      if (last || init.signal?.aborted) throw e;
      await sleep(retryDelayMs(attempt, null, { baseMs, maxWaitMs, random }));
    }
  }
}
