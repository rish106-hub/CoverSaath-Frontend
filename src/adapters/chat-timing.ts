// One place for every chat time budget, shared by the browser adapter and the BFF so they cannot drift apart.
//
// Backend evidence (CoverSaath repo, read only):
//  - src/features/ai-analysis/chat-runtime.js:17  CHAT_GATEWAY_LIMITS = { timeoutMs: 30_000, queueTimeoutMs: 5_000, ... }
//    so one model call runs at most 30 s after waiting at most 5 s in the queue.
//  - src/features/ai-analysis/model-gateway.js:155  AbortSignal.timeout(limits.timeoutMs) per provider call, maxRetries 0.
//  - src/backend/services/chat-v1-service.js:340 / :413 / :427  a turn makes up to two model calls in sequence
//    (routeQuestion, then modelAnswer), and the `meta` event is emitted between them (after the route call).
//  - chat-runtime.js callRouted (:104-:130) fails over provider by provider; each attempt has its own 30 s limit.
// The backend has no turn-level deadline, so the client sets its own, sized to the normal path of two sequential calls.

/** Longest one backend model call can take: queue wait plus the call limit (chat-runtime.js:17). */
export const BACKEND_MODEL_CALL_MAX_MS = 5_000 + 30_000;
/** Safety margin on top of the backend bound for network and the BFF hop. */
const MARGIN_MS = 10_000;

/** Longest silence between backend bytes: one model call (before `meta`, or between `meta` and the answer) plus margin. */
export const TURN_IDLE_MS = BACKEND_MODEL_CALL_MAX_MS + MARGIN_MS; // 45 s
/** BFF cap for a whole streamed turn: route call plus answer call plus margin. Failover past two calls ends as BACKEND_TIMEOUT. */
export const TURN_TIMEOUT_MS = 2 * BACKEND_MODEL_CALL_MAX_MS + MARGIN_MS; // 80 s
/** Browser watchdog: slightly past the BFF cap so the BFF's coded BACKEND_TIMEOUT arrives first. */
export const TURN_WATCHDOG_MS = TURN_TIMEOUT_MS + 5_000; // 85 s
/** BFF cap for the non-stream chat call: one model call plus margin. */
export const CHAT_TIMEOUT_MS = BACKEND_MODEL_CALL_MAX_MS + MARGIN_MS; // 45 s
/** Vercel maxDuration (seconds) for the routes, above the matching BFF cap. */
export const TURN_MAX_DURATION_S = 90;
export const CHAT_MAX_DURATION_S = 60;
