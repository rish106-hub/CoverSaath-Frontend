// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { adapters, AdapterError } from "@/adapters";
import { AgentProvider, useAgent } from "@/components/agent/AgentProvider";
import { SourceLine } from "@/components/agent/SourceLine";
import { ThemeProvider } from "@/components/theme";
import { FALLBACK_NOTICE, VOICE_NOTICE } from "@/agent/voice-gnani";
import { knownRoute } from "@/adapters/chat";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams(),
}));

const BANNED = /sample|demo|preview|draft|placeholder|lorem|not advice|not an insurer|CoverSaath|Saath/i;
const MESSAGES = {
  chatOff: "Chat is not switched on yet.",
  busy: "Voice is busy. Try again in a moment.",
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Probe() {
  const a = useAgent();
  return (
    <div>
      <button onClick={() => a.toggleMic()}>mic</button>
      <button onClick={() => a.submit("what is covered")}>ask</button>
      <output data-testid="note">{a.note}</output>
      <output data-testid="view">{a.view}</output>
      <output data-testid="thread">{a.thread.map((m) => m.text).join("|")}</output>
    </div>
  );
}
const mount = () => render(<ThemeProvider><AgentProvider><Probe /></AgentProvider></ThemeProvider>);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const note = () => screen.getByTestId("note").textContent;

describe("copy", () => {
  it("never claims the audio is not stored, and carries no banned word", () => {
    for (const s of [VOICE_NOTICE, FALLBACK_NOTICE, ...Object.values(MESSAGES)]) {
      expect(s).not.toMatch(BANNED);
      expect(s).not.toMatch(/not stored|never stored|deleted/i);
    }
    expect(VOICE_NOTICE).toBe("Audio is sent to a speech service to turn it into text.");
    expect(FALLBACK_NOTICE).toBe("Your browser's speech service will be used instead.");
  });
});

describe("SourceLine", () => {
  const evidence = { tier: "household_evidence", label: "Policy", page: 14, quote: "up to Rs 40,000", evidenceId: "e1" } as never;
  it("renders nothing without sources", () => {
    const { container } = render(<SourceLine />);
    expect(container.innerHTML).toBe("");
    const again = render(<SourceLine sources={[]} />);
    expect(again.container.innerHTML).toBe("");
  });
  it("shows the page and a labelled quote, at most two sources, with no banned words", () => {
    const { container } = render(<SourceLine sources={[evidence, evidence, evidence]} status={"evidence_found" as never} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.textContent).toContain("From your document, page 14");
    expect(container.textContent).toContain("Quote from the document: ");
    expect(container.querySelector("q")?.textContent).toBe("up to Rs 40,000");
    expect(container.textContent).not.toMatch(BANNED);
  });
  it("says not found for unknown status or when no source was found", () => {
    const a = render(<SourceLine sources={[evidence]} status={"unknown" as never} />);
    expect(a.container.textContent).toBe("Not found in your documents");
    expect(a.container.textContent).not.toMatch(BANNED);
    const b = render(<SourceLine sources={[{ tier: "none", label: "x" } as never]} />);
    expect(b.container.textContent).toBe("Not found in your documents");
  });
});

describe("knownRoute", () => {
  it("rejects control characters and colons, keeps real pages", () => {
    expect(knownRoute("/home")).toBe("/home");
    for (const bad of ["/home\n", "/home\u0000", "/home\u007f", "/home:x", "/home?next=http://x", "//evil", "/home\\x", "https://evil.test"]) expect(knownRoute(bad), bad).toBeUndefined();
  });
});

describe("AgentProvider voice and chat error branches", () => {
  beforeEach(() => {
    vi.spyOn(adapters.voice, "supported").mockReturnValue(true);
  });
  it.each([
    ["VOICE_FALLBACK_NOTICE", `${FALLBACK_NOTICE} Tap the mic to continue.`, "stays"],
    ["VOICE_BAD_AUDIO", "I could not read that audio. Tap the mic and try again.", "stays"],
    ["VOICE_MIC_DENIED", "The microphone is blocked. Type your question, or allow it in your browser.", "chat"],
    ["VOICE_BUSY", MESSAGES.busy, "chat"],
    ["VOICE_RATE_LIMITED", "Voice has reached its limit for now. Type your question.", "chat"],
    ["VOICE_RATE_UNSUPPORTED", "Voice is not available here. Type your question.", "chat"],
  ])("%s shows its own note and the right view", async (code, text, view) => {
    vi.spyOn(adapters.voice, "listen").mockRejectedValue(new AdapterError(code));
    mount();
    fireEvent.click(screen.getByText("mic"));
    await flush();
    expect(note()).toBe(text);
    const v = screen.getByTestId("view").textContent;
    if (view === "chat") expect(v).toBe("chat"); else expect(v).not.toBe("chat"); // the voice notices must not bounce the person to the text view
    expect(text).not.toMatch(BANNED);
  });
  it("shows the chat-off line when the backend says chat is not configured, and a generic retry otherwise", async () => {
    const ask = vi.spyOn(adapters.assistant, "ask").mockRejectedValueOnce(new AdapterError("CHAT_NOT_CONFIGURED")).mockRejectedValueOnce(new AdapterError("BACKEND_TIMEOUT"));
    mount();
    fireEvent.click(screen.getByText("ask")); await flush();
    expect(note()).toBe(MESSAGES.chatOff);
    fireEvent.click(screen.getByText("ask")); await flush();
    expect(note()).toBe("That did not work. Try again.");
    expect(ask).toHaveBeenCalledTimes(2);
  });
  it("releases the microphone when the provider unmounts", async () => {
    const stop = vi.spyOn(adapters.voice, "stop");
    const { unmount } = mount();
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
