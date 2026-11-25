// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { TurnEvent } from "@/adapters/chat-contract";
import type { HoldingView } from "@/adapters/covers-contract";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/chat" }));

const holdings: HoldingView[] = [
  { id: "h1", status: "ready", summary: { insurerName: "Acme Health", productName: "Optima Secure" } },
  { id: "h2", status: "ready", summary: { insurerName: "Acme Health", productName: "Optima Secure" } },
  { id: "h3", status: "ready", summary: { insurerName: "Zenith", productName: null } },
  { id: "h4", status: "ready", summary: null },
];
let release: () => void = () => undefined;
const turn = vi.fn();
vi.mock("@/adapters", () => ({
  adapters: {
    covers: { holdings: async () => holdings, hospitals: vi.fn() },
    chat: { startThread: async () => ({ id: "th", holdingId: "h1" }), turn: (...a: unknown[]) => turn(...a), consent: async () => true },
    voice: { supported: () => false, stop: vi.fn(), listen: vi.fn() },
  },
}));

import { ChatView } from "@/components/chat/ChatView";
import { HospitalsView } from "@/components/chat/HospitalsView";
import { holdingLabels } from "@/components/covers/holding-label";

beforeEach(() => {
  turn.mockReset().mockImplementation(async (_id: string, _in: unknown, on: (e: TurnEvent) => void) => {
    on({ type: "delta", data: { text: "Thirty " } });
    await new Promise<void>((r) => { release = r; });
    on({ type: "answer", data: { turnId: "t1", status: "evidence_found", intent: "x", answer: "Thirty days.", answerSource: "deterministic", factsUsed: [], computed: null, openConflicts: [] } });
  });
});
afterEach(cleanup);

describe("cover picker labels (#108 row 9)", () => {
  it("names each option by insurer and plan, tells duplicates apart, falls back to Cover N", () => {
    expect([...holdingLabels(holdings).values()]).toEqual(["Acme Health, Optima Secure (1)", "Acme Health, Optima Secure (2)", "Zenith", "Cover 4"]);
  });

  it("shows those labels in the Chat picker", async () => {
    render(<ChatView />);
    const picker = await screen.findByLabelText("Cover");
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Acme Health, Optima Secure (1)", "Acme Health, Optima Secure (2)", "Zenith", "Cover 4"]);
  });

  it("shows those labels in the Network hospitals picker", async () => {
    render(<HospitalsView />);
    const picker = await screen.findByLabelText("Cover");
    expect(within(picker).getAllByRole("option")[2].textContent).toBe("Zenith");
  });
});

describe("chat announcements (#108 row 8)", () => {
  it("keeps the log silent and marks the streaming message busy, then announces the finished answer once", async () => {
    render(<ChatView />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Planned knee surgery in Jan, is it covered?" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Planned knee surgery in Jan, is it covered?" }));
    const log = await screen.findByRole("log", { name: "Conversation" });
    expect(log.getAttribute("aria-live")).toBe("off");
    const announcer = document.querySelector('[data-role="answer-announcer"]') as HTMLElement;
    await waitFor(() => expect(within(log).getByText("Thirty")).toBeDefined());
    const reply = log.querySelectorAll("li")[1];
    expect(reply.getAttribute("aria-busy")).toBe("true");
    expect(announcer.textContent).toBe("");
    release();
    await waitFor(() => expect(announcer.textContent).toBe("Thirty days."));
    expect(reply.getAttribute("aria-busy")).toBeNull();
    expect(announcer.getAttribute("aria-live")).toBe("polite");
  });
});
