// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AgentProvider, AskDock } from "@/components/agent";
import { HeaderMic } from "@/components/agent";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

describe("voice shortcut is discoverable", () => {
  it("dock shows a V keycap and announces the shortcut", () => {
    const { container } = render(<AgentProvider><AskDock /></AgentProvider>);
    const dock = container.querySelector("[data-ask-trigger]")!;
    expect(dock.getAttribute("aria-keyshortcuts")).toBe("V");
    expect(dock.getAttribute("title")).toMatch(/hold V/i);
    expect(dock.querySelector("kbd")?.textContent).toBe("V");
  });
  it("header mic announces the shortcut", () => {
    const { container } = render(<AgentProvider><HeaderMic /></AgentProvider>);
    const b = container.querySelector("button")!;
    expect(b.getAttribute("aria-keyshortcuts")).toBe("V");
    expect(b.getAttribute("title")).toMatch(/hold V/i);
  });
});
