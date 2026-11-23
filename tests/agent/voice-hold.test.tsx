// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AgentProvider, AskDock, HeaderMic } from "@/components/agent";
import { AgentLayer } from "@/components/agent/AgentLayer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => { process.env.NEXT_PUBLIC_VOICE_ON_HOLD = "true"; });
afterEach(() => { cleanup(); process.env.NEXT_PUBLIC_VOICE_ON_HOLD = "false"; });

describe("voice on hold", () => {
  it("header mic renders nothing", () => {
    const { container } = render(<AgentProvider><HeaderMic /></AgentProvider>);
    expect(container.querySelector("button")).toBeNull();
  });
  it("dock is a typed 'Ask Knowvia' button with no mic, key cap or wave", () => {
    const { container } = render(<AgentProvider><AskDock /></AgentProvider>);
    const dock = container.querySelector("[data-ask-trigger]")!;
    expect(dock.textContent).toBe("Ask Knowvia");
    expect(dock.getAttribute("aria-keyshortcuts")).toBeNull();
    expect(dock.querySelector("kbd, svg")).toBeNull();
  });
  it("shows no voice intro dialog", () => {
    const { container } = render(<AgentProvider><AgentLayer /></AgentProvider>);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Talk to Knowvia/);
  });
});
