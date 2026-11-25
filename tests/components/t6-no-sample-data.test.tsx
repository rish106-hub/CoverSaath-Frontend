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
