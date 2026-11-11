// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { TurnEvent } from "@/adapters/chat-contract";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/chat" }));

const turn = vi.fn();
const startThread = vi.fn();
const listen = vi.fn();
const hospitals = vi.fn();
vi.mock("@/adapters", () => ({
  adapters: {
    covers: { holdings: async () => [{ id: "hold-1", status: "ready" }], hospitals: (...a: unknown[]) => hospitals(...a) },
    chat: { startThread: (...a: unknown[]) => startThread(...a), turn: (...a: unknown[]) => turn(...a) },
    voice: { supported: () => true, listen: () => listen(), stop: vi.fn(), notice: "Audio is sent to a speech service to turn it into text." },
  },
}));

import { ChatView } from "@/components/chat/ChatView";
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
    expect(screen.getByText("Thirty days.")).toBeDefined();
    expect(startThread).toHaveBeenCalledWith("hold-1");
    expect(turn.mock.calls[0]?.[1]).toEqual({ message: "Is knee surgery covered?", inputKind: "text" });
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
