// @vitest-environment jsdom
// T6: nothing on the public, tools or chat screens is invented. Renders each screen and scans its text for the old sample
// names, products, pincode and amounts, so a sample figure cannot creep back in.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/adapters", async (orig) => ({
  ...(await orig<typeof import("@/adapters")>()),
  adapters: {
    ...(await orig<typeof import("@/adapters")>()).adapters,
    covers: { holdings: async () => [{ id: "hold-1", status: "ready" }], hospitals: vi.fn() },
    chat: { startThread: vi.fn(), turn: vi.fn(), consent: async () => true, grantConsent: vi.fn(), revokeConsent: vi.fn() },
    voice: { supported: () => false, listen: vi.fn(), stop: vi.fn(), notice: "" },
  },
}));

import { Landing } from "@/components/public/Landing";
import { Tour } from "@/components/public/Tour";
import { SignIn } from "@/components/public/SignIn";
import { ToolsPage } from "@/components/tools/ToolsPage";
import { ChatView } from "@/components/chat/ChatView";
import { SoonButton } from "@/components/ui/SoonButton";
import { PAGE_CONTEXT } from "@/agent/page-registry";
import { VOICE_COMMANDS } from "@/agent/voice-commands";
import { TOUR_SCENES } from "@/data/mock";

const SAMPLE = /Meera|Rohan|Kabir|Mumma|Papa|Priya|Northstar|Kaveri|Meridian|Indus|400053|6200|38400/;
const STANDARD = ["What are my waiting periods?", "What does my policy not cover?", "Find a cashless hospital near me"];

afterEach(cleanup);

describe("T6 no sample data on screen", () => {
  it("Landing, Tour and SignIn render no sample name, product or figure", () => {
    stubWide();
    for (const ui of [<Landing key="l" />, <Tour key="t" scene={0} tick={0} play={false} onPick={() => undefined} onToggle={() => undefined} />, <SignIn key="s" />]) {
      const { container, unmount } = render(ui);
      expect(container.textContent).not.toMatch(SAMPLE);
      unmount();
    }
  });
  it("every Tour scene is redacted: no rupee figure with digits, no name", () => {
    for (const sc of TOUR_SCENES) {
      const text = JSON.stringify([sc.title, sc.tag, sc.tiles, sc.bars.map((b) => [b[0], b[3]]), sc.say, sc.reply]);
      expect(text).not.toMatch(SAMPLE);
      expect(text).not.toMatch(/Rs ?\d/);
    }
  });
  it("Tools renders empty inputs, dashes for results and no sample figures", () => {
    const { container } = render(<ToolsPage />);
    expect(container.textContent).not.toMatch(SAMPLE);
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs[0]!.value).toBe("");
    expect(inputs[0]!.placeholder).toBe("0");
    expect(container.textContent).toContain("—");
  });
  it("Chat offers the three standard prompts and no sample text", async () => {
    const { container } = render(<ChatView />);
    for (const p of STANDARD) expect(await screen.findByRole("button", { name: p })).toBeTruthy();
    expect(container.textContent).not.toMatch(SAMPLE);
  });
  it("registry and voice commands carry no sample names", () => {
    expect(JSON.stringify(PAGE_CONTEXT)).not.toMatch(SAMPLE);
    expect(JSON.stringify(VOICE_COMMANDS)).not.toMatch(SAMPLE);
    for (const ctx of Object.values(PAGE_CONTEXT)) {
      expect(ctx.reads).toBe("your policies and this page");
      expect(ctx.examples.map((e) => e.say)).toEqual(STANDARD);
    }
  });
  it("SoonButton is inert and says Soon", () => {
    const onSubmit = vi.fn();
    render(<form onSubmit={onSubmit}><SoonButton className="k-btn--sm">Book a call</SoonButton></form>);
    const btn = screen.getByRole("button", { name: /Book a call/ });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn).toHaveAttribute("title", "Coming soon");
    expect(btn.textContent).toContain("Soon");
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

function stubWide() {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("min-width"), addEventListener: () => undefined, removeEventListener: () => undefined }));
}
