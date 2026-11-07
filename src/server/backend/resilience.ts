import "server-only";
import { AppError } from "./errors";
import type { FetchLike } from "./client";

/**
 * Protects the backend (one Fly machine, per-process limits) and the site from a pile-up.
 * Two guards around every backend fetch:
 *  - bulkhead: at most `maxInflight` backend calls at once per serverless instance. Extra calls fail fast
 *    instead of queueing until the platform timeout.
 *  - circuit breaker: after `failureThreshold` failures in a row (network error, timeout, 502, 503 or 504; a plain 500 or any 4xx is the
 *    backend answering, not being down, so it does not count) calls fail fast
 *    for `cooldownMs`, then one probe call decides whether to close again.
 * Fast failures are a coded 503 BACKEND_BUSY with Retry-After, which the app shows as a retry state, never a crash.
 * State is per instance. It lowers load on the backend; it is not a global cap (that needs shared storage).
 */
export type GuardOptions = {
  maxInflight?: number;
  failureThreshold?: number;
  cooldownMs?: number;
  retryAfterSeconds?: number;
  now?: () => number;
};

export type GuardState = { inflight: number; consecutiveFailures: number; open: boolean };

/** Only "the backend is not there" statuses trip the breaker. A 500 from one route (for example a bad identity sign-in) must not take every route down. */
export const isUnavailable = (status: number): boolean => status === 502 || status === 503 || status === 504;

export function createGuard(opts: GuardOptions = {}) {
  const maxInflight = opts.maxInflight ?? 32;
  const failureThreshold = opts.failureThreshold ?? 5;
  const cooldownMs = opts.cooldownMs ?? 10_000;
  const retryAfter = opts.retryAfterSeconds ?? 5;
  const now = opts.now ?? Date.now;

  let inflight = 0;
  let failures = 0;
  let openUntil = 0;
  let probing = false;

  const busy = () => new AppError(503, "BACKEND_BUSY", true, retryAfter);

  function admit(): boolean {
    if (inflight >= maxInflight) throw busy();
    if (failures >= failureThreshold) {
      if (now() < openUntil || probing) throw busy();
      probing = true; // half-open: this call is the single probe
      return true;
    }
    return false;
  }

  function settle(probe: boolean, failed: boolean) {
    if (probe) probing = false;
    if (failed) {
      failures += 1;
      if (failures >= failureThreshold) openUntil = now() + cooldownMs;
    } else {
      failures = 0;
    }
  }

  function wrap(doFetch: FetchLike): FetchLike {
    return async (input, init) => {
      const probe = admit();
      inflight += 1;
      try {
        const res = await doFetch(input, init);
        settle(probe, isUnavailable(res.status));
        return res;
      } catch (e) {
        settle(probe, true);
        throw e;
      } finally {
        inflight -= 1;
      }
    };
  }

  const state = (): GuardState => ({ inflight, consecutiveFailures: failures, open: failures >= failureThreshold && now() < openUntil });
  return { wrap, state };
}

/** Shared by every backend sender in this instance. Tests inject their own fetch and bypass it. */
export const backendGuard = createGuard();
export const guardedFetch: FetchLike = backendGuard.wrap((u, i) => globalThis.fetch(u, i));
