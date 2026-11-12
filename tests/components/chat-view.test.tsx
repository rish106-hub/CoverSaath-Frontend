// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { TurnEvent } from "@/adapters/chat-contract";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/chat" }));

const turn = vi.fn();
const startThread = vi.fn();
const listen = vi.fn();
const hospitals = vi.fn();
const consentGet = vi.fn();
const consentGrant = vi.fn();
vi.mock("@/adapters", () => ({
  adapters: {
    covers: { holdings: async () => [{ id: "hold-1", status: "ready" }], hospitals: (...a: unknown[]) => hospitals(...a) },
    chat: { startThread: (...a: unknown[]) => startThread(...a), turn: (...a: unknown[]) => turn(...a), consent: () => consentGet(), grantConsent: (...a: unknown[]) => consentGrant(...a), revokeConsent: vi.fn() },
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
  consentGet.mockReset().mockResolvedValue(true);
  consentGrant.mockReset().mockResolvedValue(undefined);
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

describe("ChatView go-ahead", () => {
  it("asks for the go-ahead first, names both providers, and keeps Ask off until it is given", async () => {
    consentGet.mockResolvedValue(false);
    render(<ChatView />);
    expect(await screen.findByText("Before we answer")).toBeDefined();
    expect(screen.getByText(/Anthropic/)).toBeDefined();
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
