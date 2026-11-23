import { beforeEach, describe, expect, it } from "vitest";
import { mockChat, resetMockChatTimeouts } from "@/adapters/mock/chat";
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
});
