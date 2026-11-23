// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const consentGet = vi.fn();
const consentGrant = vi.fn();
const submit = vi.fn();
const demo = vi.fn();

vi.mock("@/adapters", () => ({
  adapters: { chat: { consent: () => consentGet(), grantConsent: (...a: unknown[]) => consentGrant(...a), revokeConsent: vi.fn() }, voice: { supported: () => false, notice: "" } },
}));
vi.mock("@/adapters/mode", () => ({ useBackend: true }));
vi.mock("@/adapters/demo", () => ({ isDemoSession: () => demo() }));
vi.mock("@/agent/page-context", () => ({ usePageContext: () => ({ examples: [{ say: "What is covered?" }] }) }));
vi.mock("@/components/agent/AgentProvider", () => ({
  useAgent: () => ({ chatOpen: true, thread: [], thinking: false, hold: { state: "idle" }, submit, close: vi.fn(), toggleMic: vi.fn() }),
}));

import { AskChatPane } from "@/components/agent/AskChatPane";

beforeEach(() => {
  consentGet.mockReset().mockResolvedValue(false);
  consentGrant.mockReset().mockResolvedValue(undefined);
  submit.mockReset();
  demo.mockReset().mockReturnValue(false);
});
afterEach(cleanup);

describe("Ask panel go-ahead", () => {
  it("asks first for a real session, then lets the question through", async () => {
    render(<AskChatPane />);
    expect(await screen.findByText(/Gemini/)).toBeDefined();
    expect(screen.getByText(/Voyage/)).toBeDefined();
    expect(screen.queryByLabelText("Message to Ask Knowvia")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(consentGrant).toHaveBeenCalledTimes(1));
    const input = await screen.findByLabelText("Message to Ask Knowvia");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(submit).toHaveBeenCalledWith("hello");
  });
  it("shows the card when the check fails", async () => {
    consentGet.mockRejectedValue(new Error("down"));
    render(<AskChatPane />);
    expect(await screen.findByText(/Gemini/)).toBeDefined();
  });
  it("does not ask when consent is already given", async () => {
    consentGet.mockResolvedValue(true);
    render(<AskChatPane />);
    expect(await screen.findByLabelText("Message to Ask Knowvia")).toBeDefined();
    expect(screen.queryByText(/Gemini/)).toBeNull();
  });
  it("leaves the demo session unchanged: no check, no card", async () => {
    demo.mockReturnValue(true);
    render(<AskChatPane />);
    expect(await screen.findByLabelText("Message to Ask Knowvia")).toBeDefined();
    expect(consentGet).not.toHaveBeenCalled();
  });
});
