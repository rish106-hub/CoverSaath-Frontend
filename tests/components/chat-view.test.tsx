// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { TurnEvent } from "@/adapters/chat-contract";

// The page's "Still working…" delay, shortened so the tests run on real timers (Testing Library's waitFor hangs under fake setTimeout).
const SLOW_AFTER_MS = 60;
vi.mock("@/adapters/chat-timing", async (orig) => ({ ...(await orig<typeof import("@/adapters/chat-timing")>()), SLOW_AFTER_MS: 60 }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/chat" }));

const turn = vi.fn();
const startThread = vi.fn();
const listen = vi.fn();
const hospitals = vi.fn();
const consentGet = vi.fn();
const consentGrant = vi.fn();
const consentRevoke = vi.fn();
vi.mock("@/adapters", () => ({
  adapters: {
    covers: { holdings: async () => [{ id: "hold-1", status: "ready" }], hospitals: (...a: unknown[]) => hospitals(...a) },
    chat: { startThread: (...a: unknown[]) => startThread(...a), turn: (...a: unknown[]) => turn(...a), consent: () => consentGet(), grantConsent: (...a: unknown[]) => consentGrant(...a), revokeConsent: () => consentRevoke() },
    voice: { supported: () => true, listen: () => listen(), stop: vi.fn(), notice: "Audio is sent to a speech service to turn it into text." },
  },
}));

import { ChatView } from "@/components/chat/ChatView";
import { act } from "@testing-library/react";
import { HospitalsView } from "@/components/chat/HospitalsView";

const answer = (over = {}): TurnEvent => ({ type: "answer", data: { turnId: "t1", status: "evidence_found", intent: "x", answer: "Thirty days.", answerSource: "deterministic",
  factsUsed: [{ factId: "f1", factKey: "room_rent_limit", label: "Room rent limit", status: "conflicting", valueText: "1% or 2%", checkWithInsurer: true }, { factId: "f2", factKey: "initial_waiting_days", label: "Initial waiting period", status: "reviewed_reference", valueText: "30 days", checkWithInsurer: false }],
  computed: null, openConflicts: [], ...over } });

beforeEach(() => {
  startThread.mockReset().mockResolvedValue({ id: "th-1", holdingId: "hold-1" });
  turn.mockReset().mockImplementation(async (_id: string, _in: unknown, on: (e: TurnEvent) => void) => {
    on({ type: "delta", data: { text: "Thirty " } });
    on(answer());
    on({ type: "done", data: {} });
  });
  listen.mockReset();
  hospitals.mockReset();
  consentGet.mockReset().mockResolvedValue(true);
  consentGrant.mockReset().mockResolvedValue(undefined);
  consentRevoke.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("ChatView", () => {
  it("shows the answer with facts chips and check-with-insurer where the backend marks it", async () => {
    render(<ChatView />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).toBeDefined());
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Is knee surgery covered?" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const facts = await screen.findByRole("list", { name: "Facts used" });
    expect(within(facts).getAllByRole("listitem")).toHaveLength(2);
    expect(within(facts).getAllByText("Check with the insurer")).toHaveLength(1);
    expect(within(screen.getByRole("log")).getByText("Thirty days.")).toBeDefined();
    expect(startThread).toHaveBeenCalledWith("hold-1");
    expect(turn.mock.calls[0]?.[1]).toEqual({ message: "Is knee surgery covered?", inputKind: "text" });
  });

  it("shows no voice button or microphone note while voice is on hold", async () => {
    process.env.NEXT_PUBLIC_VOICE_ON_HOLD = "true";
    try {
      render(<ChatView />);
      await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).toBeDefined());
      expect(screen.queryByRole("button", { name: /Ask by voice/ })).toBeNull();
      expect(screen.queryByText(/words you speak/)).toBeNull();
    } finally { process.env.NEXT_PUBLIC_VOICE_ON_HOLD = "false"; }
  });

  it("sends a spoken question as a voice turn and keeps no audio", async () => {
    listen.mockResolvedValue("Is cataract covered");
    render(<ChatView />);
    const mic = await screen.findByRole("button", { name: /Ask by voice/ });
    fireEvent.click(mic);
    await waitFor(() => expect(turn).toHaveBeenCalled());
    expect(turn.mock.calls[0]?.[1]).toEqual({ message: "Is cataract covered", inputKind: "voice" });
    expect(await screen.findByText("You said")).toBeDefined();
    expect(JSON.stringify(turn.mock.calls[0]?.[1])).not.toMatch(/audio/i);
  });

  it("explains a blocked microphone and sends nothing", async () => {
    const { AdapterError } = await import("@/adapters/types");
    listen.mockRejectedValue(new AdapterError("VOICE_MIC_DENIED"));
    render(<ChatView />);
    fireEvent.click(await screen.findByRole("button", { name: /Ask by voice/ }));
    expect(await screen.findByText(/microphone is blocked/)).toBeDefined();
    expect(turn).not.toHaveBeenCalled();
  });

  it("shows a coded message when the turn fails", async () => {
    const { AdapterError } = await import("@/adapters/types");
    turn.mockRejectedValue(new AdapterError("MEMORY_DISABLED"));
    render(<ChatView />);
    fireEvent.click(await screen.findByRole("button", { name: /Cashless hospitals near 400053/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/not switched on/);
  });

  it("on a turn timeout clears the partial words, says it took too long and Retry resends the same message", async () => {
    const { AdapterError } = await import("@/adapters/types");
    turn.mockReset().mockImplementationOnce(async (_i: string, _x: unknown, on: (e: TurnEvent) => void) => {
      on({ type: "delta", data: { text: "Partial words " } });
      throw new AdapterError("CHAT_TURN_TIMEOUT", true);
    }).mockImplementation(async (_i: string, _x: unknown, on: (e: TurnEvent) => void) => { on(answer()); on({ type: "done", data: {} }); });
    render(<ChatView />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).toBeDefined());
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Is knee surgery covered?" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect((await screen.findByRole("alert")).textContent).toBe("That took too long. Try again.");
    expect(screen.queryByText(/Partial words/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await within(screen.getByRole("log")).findByText("Thirty days.")).toBeDefined();
    expect(turn).toHaveBeenCalledTimes(2);
    expect(turn.mock.calls[1]?.[1]).toEqual(turn.mock.calls[0]?.[1]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getAllByText("Is knee surgery covered?")).toHaveLength(1);
  });

  it("shows the generic line with Retry for another error code or a dropped stream", async () => {
    const { AdapterError } = await import("@/adapters/types");
    turn.mockRejectedValue(new AdapterError("CHAT_STREAM_FAILED", true));
    render(<ChatView />);
    fireEvent.click(await screen.findByRole("button", { name: /What are my waiting periods/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong. Try again.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
  });
});

describe("ChatView pending states", () => {
  const hangUntilAbort = () => turn.mockReset().mockImplementation((_i: string, _x: unknown, _on: unknown, signal?: AbortSignal) => new Promise<void>((resolve) => { signal?.addEventListener("abort", () => resolve(), { once: true }); }));
  const state = () => document.querySelector('li[data-role="assistant"]')?.getAttribute("data-state");
  const askTyped = async (q: string) => {
    render(<ChatView />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).toBeDefined());
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: q } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  };

  it("goes pending, then slow with 'Still working…' after the slow line, then answered", async () => {
    let finish: () => void = () => undefined;
    turn.mockReset().mockImplementation((_i: string, _x: unknown, on: (e: TurnEvent) => void) => new Promise<void>((resolve) => { finish = () => { on(answer()); on({ type: "done", data: {} }); resolve(); }; }));
    await askTyped("Is knee surgery covered?");
    await waitFor(() => expect(state()).toBe("pending"));
    expect(screen.queryByText("Still working…")).toBeNull();
    await waitFor(() => expect(state()).toBe("slow"));
    expect(screen.getByText("Still working…")).toBeDefined();
    await act(async () => { finish(); });
    await waitFor(() => expect(state()).toBe("answered"));
    expect(screen.queryByText("Still working…")).toBeNull();
  });

  it("blocks a second submit while pending: two submits in the same tick send one turn", async () => {
    hangUntilAbort();
    await askTyped("Is knee surgery covered?");
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "And waiting periods?" } });
    const form = screen.getByRole("form", { name: "Ask a question" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(turn).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("marks a timed out turn timed_out, a dropped one failed, and Retry shows retrying before the answer", async () => {
    const { AdapterError } = await import("@/adapters/types");
    let finish: () => void = () => undefined;
    turn.mockReset()
      .mockRejectedValueOnce(new AdapterError("BACKEND_TIMEOUT", true))
      .mockImplementationOnce(() => Promise.reject(new AdapterError("CHAT_STREAM_FAILED", true)))
      .mockImplementation((_i: string, _x: unknown, on: (e: TurnEvent) => void) => new Promise<void>((resolve) => { finish = () => { on(answer()); on({ type: "done", data: {} }); resolve(); }; }));
    await askTyped("Is knee surgery covered?");
    await waitFor(() => expect(state()).toBe("timed_out"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(state()).toBe("failed"));
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(state()).toBe("retrying"));
    expect(screen.getByText("Trying again…")).toBeDefined();
    await act(async () => { finish(); });
    await waitFor(() => expect(state()).toBe("answered"));
    expect(turn).toHaveBeenCalledTimes(3);
  });

  it("never leaves the input stuck after an error: Ask works again for the next question", async () => {
    const { AdapterError } = await import("@/adapters/types");
    turn.mockReset().mockRejectedValueOnce(new AdapterError("BACKEND_UNREACHABLE", true)).mockImplementation(async (_i: string, _x: unknown, on: (e: TurnEvent) => void) => { on(answer()); on({ type: "done", data: {} }); });
    await askTyped("Is knee surgery covered?");
    await screen.findByRole("alert");
    const box = screen.getByLabelText("Your question") as HTMLTextAreaElement;
    expect(box.disabled).toBe(false);
    fireEvent.change(box, { target: { value: "What are my waiting periods?" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(turn).toHaveBeenCalledTimes(2));
    expect(await within(screen.getByRole("log")).findByText("Thirty days.")).toBeDefined();
  });

  it("on unmount while pending: aborts the turn, clears the slow timer and sets no state later", async () => {
    hangUntilAbort();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const slowTimers: unknown[] = [];
    const cleared: unknown[] = [];
    const realSet = globalThis.setTimeout;
    const realClear = globalThis.clearTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
      const id = realSet(fn, ms, ...rest);
      if (ms === SLOW_AFTER_MS) slowTimers.push(id);
      return id;
    }) as typeof setTimeout);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(((id?: Parameters<typeof clearTimeout>[0]) => { cleared.push(id); return realClear(id); }) as typeof clearTimeout);
    try {
      const { unmount } = render(<ChatView />);
      const prompt = await screen.findByRole("button", { name: /What are my waiting periods/ });
      await waitFor(() => expect((prompt as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(prompt);
      await waitFor(() => expect(turn).toHaveBeenCalledTimes(1));
      const signal = turn.mock.calls[0]?.[3] as AbortSignal;
      expect(slowTimers).toHaveLength(1);
      unmount();
      expect(signal.aborted).toBe(true);
      expect(cleared).toContain(slowTimers[0]);
      await new Promise((r) => realSet(r, SLOW_AFTER_MS * 3));
      expect(errors).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("ChatView go-ahead", () => {
  it("asks for the go-ahead first, names both providers, and keeps Ask off until it is given", async () => {
    consentGet.mockResolvedValue(false);
    render(<ChatView />);
    expect(await screen.findByText("Before we answer")).toBeDefined();
    expect(screen.getByText(/Gemini/)).toBeDefined();
    expect(screen.getByText(/Voyage/)).toBeDefined();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Waiting periods?" } });
    expect((screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(consentGrant).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("Before we answer")).toBeNull());
    await waitFor(() => expect((screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled).toBe(false));
  });
  it("shows the card when the go-ahead check fails (fails closed)", async () => {
    consentGet.mockRejectedValue(new Error("down"));
    render(<ChatView />);
    expect(await screen.findByText("Before we answer")).toBeDefined();
    expect((screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("withdraws the go-ahead and brings the card back", async () => {
    render(<ChatView />);
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw consent" }));
    await waitFor(() => expect(consentRevoke).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Before we answer")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Withdraw consent" })).toBeNull();
  });
  it("shows the card again when a turn is refused for missing go-ahead", async () => {
    const { AdapterError } = await import("@/adapters/types");
    turn.mockRejectedValue(new AdapterError("CONSENT_REQUIRED"));
    render(<ChatView />);
    fireEvent.click(await screen.findByRole("button", { name: /What are my waiting periods/ }));
    expect(await screen.findByText("Before we answer")).toBeDefined();
  });
  it("notes figures the backend did not match to a fact", async () => {
    turn.mockImplementation(async (_i: string, _x: unknown, on: (e: TurnEvent) => void) => { on(answer({ modelStatus: "numbers_unverified", truncated: false })); on({ type: "done", data: {} }); });
    render(<ChatView />);
    fireEvent.click(await screen.findByRole("button", { name: /What are my waiting periods/ }));
    expect(await screen.findByText(/figures in this answer are not matched/)).toBeDefined();
  });
});

describe("HospitalsView", () => {
  it("lists hospitals for a pincode", async () => {
    hospitals.mockResolvedValue([{ id: "a", name: "Example City Hospital", address: "1 Road", city: "Mumbai", pincode: "400053", cashless: true }, { id: "b", name: "Lakeside Care Centre", cashless: false }]);
    render(<HospitalsView pincode="400053" />);
    const go = await screen.findByRole("button", { name: "Find hospitals" });
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(go);
    const list = await screen.findByRole("list", { name: "Hospitals" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(hospitals).toHaveBeenCalledWith("hold-1", "400053");
    expect(screen.getByText("Cashless not listed")).toBeDefined();
  });
  it("does not search for a short pincode", async () => {
    render(<HospitalsView pincode="40" />);
    const go = await screen.findByRole("button", { name: "Find hospitals" });
    expect((go as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("citationLines", () => {
  it("maps backend sources (kind wording, snake_case document_id) to document and page", async () => {
    const { citationLines } = await import("@/components/chat/ChatView");
    const a = { sources: [{ kind: "wording", document_id: "d-1", page: 7, ref: "4.2" }, { kind: "wording", document_id: "d-1", page: 7, ref: "4.3" }], factsUsed: [] } as unknown as import("@/adapters/chat-contract").TurnAnswer;
    expect(citationLines(a)).toEqual(["Policy terms and conditions, page 7"]);
  });
});
