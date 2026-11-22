import { describe, expect, it } from "vitest";
import { BACKEND_MODEL_CALL_MAX_MS, CHAT_MAX_DURATION_S, CHAT_TIMEOUT_MS, TURN_IDLE_MS, TURN_MAX_DURATION_S, TURN_TIMEOUT_MS, TURN_WATCHDOG_MS } from "@/adapters/chat-timing";

// Backend: one model call is at most 30 s plus a 5 s queue wait (CoverSaath chat-runtime.js:17); a turn makes two calls in sequence.
describe("chat time budgets", () => {
  it("cover the backend's slowest normal turn with margin", () => {
    expect(BACKEND_MODEL_CALL_MAX_MS).toBe(35_000);
    expect(CHAT_TIMEOUT_MS).toBeGreaterThan(BACKEND_MODEL_CALL_MAX_MS);
    expect(TURN_IDLE_MS).toBeGreaterThan(BACKEND_MODEL_CALL_MAX_MS);
    expect(TURN_TIMEOUT_MS).toBeGreaterThan(2 * BACKEND_MODEL_CALL_MAX_MS);
  });
  it("nest browser inside BFF inside the Vercel limit", () => {
    expect(TURN_WATCHDOG_MS).toBeGreaterThan(TURN_TIMEOUT_MS);
    expect(TURN_MAX_DURATION_S * 1000).toBeGreaterThan(TURN_WATCHDOG_MS);
    expect(CHAT_MAX_DURATION_S * 1000).toBeGreaterThan(CHAT_TIMEOUT_MS);
    expect(TURN_IDLE_MS).toBeLessThan(TURN_TIMEOUT_MS);
  });
});
