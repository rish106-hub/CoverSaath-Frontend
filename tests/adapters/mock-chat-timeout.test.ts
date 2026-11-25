import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_SLOW_MS, mockChat, resetMockChatTimeouts } from "@/adapters/mock/chat";
import { SLOW_AFTER_MS } from "@/adapters/chat-timing";
import { vi } from "vitest";
import type { TurnEvent } from "@/adapters/chat-contract";

beforeEach(() => resetMockChatTimeouts());

describe("mock chat timeout scenario", () => {
  it("times out the first try of a 'simulate timeout' message and answers the retry", async () => {
    await mockChat.grantConsent("r1");
    const t = await mockChat.startThread();
    const seen: TurnEvent[] = [];
    const msg = { message: "Please simulate timeout for waiting periods" };
    await expect(mockChat.turn(t.id, msg, (e) => seen.push(e))).rejects.toMatchObject({ code: "CHAT_TURN_TIMEOUT", retryable: true });
    expect(seen.some((e) => e.type === "answer")).toBe(false);
    const again: TurnEvent[] = [];
    await mockChat.turn(t.id, msg, (e) => again.push(e));
    expect(again.at(-1)?.type).toBe("done");
  });

  it("fails the first try of a 'simulate fail' message with a dropped stream before any words, and answers the retry", async () => {
    await mockChat.grantConsent("r1");
    const t = await mockChat.startThread();
    const seen: TurnEvent[] = [];
    const msg = { message: "Please simulate fail for room rent" };
    await expect(mockChat.turn(t.id, msg, (e) => seen.push(e))).rejects.toMatchObject({ code: "CHAT_STREAM_FAILED", retryable: true });
    expect(seen).toEqual([]);
    const again: TurnEvent[] = [];
    await mockChat.turn(t.id, msg, (e) => again.push(e));
    expect(again.at(-1)?.type).toBe("done");
  });

  it("stays silent past the page's slow line on 'simulate slow', then answers", async () => {
    vi.useFakeTimers();
    try {
      await mockChat.grantConsent("r1");
      const t = await mockChat.startThread();
      const seen: TurnEvent[] = [];
      const run = mockChat.turn(t.id, { message: "simulate slow, waiting periods?" }, (e) => seen.push(e));
      await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS);
      expect(seen).toEqual([]);
      expect(MOCK_SLOW_MS).toBeGreaterThan(SLOW_AFTER_MS);
      await vi.advanceTimersByTimeAsync(MOCK_SLOW_MS);
      await run;
      expect(seen.at(-1)?.type).toBe("done");
    } finally {
      vi.useRealTimers();
    }
  });
});
