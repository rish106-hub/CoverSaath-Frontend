// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme";
import { AppShell } from "@/components/shell";
import { stagger } from "@/lib/motion";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/compare",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => { cleanup(); document.documentElement.setAttribute("data-theme", "light"); });

const shell = () => render(<ThemeProvider><AppShell pathname="/compare"><p>body</p></AppShell></ThemeProvider>);
const dockBtn = () => document.querySelector<HTMLElement>("[data-ask-trigger]") as HTMLElement;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("sidebar rail and brand", () => {
  it("shows the K mark link inside the sidebar and every nav link has a tooltip label", async () => {
    const { container } = shell();
    await flush();
    const side = container.querySelector("aside") as HTMLElement;
    const brand = within(side).getByRole("link", { name: "Knowvia home" });
    expect(brand.querySelector("img")?.getAttribute("src")).toBe("/brand/knowvia-mark.svg");
    const links = within(within(side).getByRole("navigation", { name: "Knowvia sections" })).getAllByRole("link");
    expect(links.length).toBeGreaterThan(5);
    for (const l of links) {
      expect(l.getAttribute("data-tip")).toBeTruthy();
      expect(l.textContent?.trim()).toBe(l.getAttribute("data-tip"));
    }
  });

  it("keeps the theme control out of the sidebar and in the top bar", async () => {
    const { container } = shell();
    await flush();
    const side = container.querySelector("aside") as HTMLElement;
    expect(within(side).queryByRole("button", { name: /theme/i })).toBeNull();
    const btn = screen.getByRole("button", { name: "Switch to dark theme" });
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });
});

type FakeRec = { start(): void; stop(): void; onresult: ((e: unknown) => void) | null; onend: (() => void) | null; onerror: ((e: unknown) => void) | null; lang: string; interimResults: boolean; continuous: boolean; abort(): void };
let heard = "";
function installVoice() {
  class Rec implements FakeRec {
    lang = ""; interimResults = false; continuous = false;
    onresult: FakeRec["onresult"] = null; onend: FakeRec["onend"] = null; onerror: FakeRec["onerror"] = null;
    start() {}
    stop() { if (heard) this.onresult?.({ results: [[{ transcript: heard }]] }); this.onend?.(); }
    abort() {}
  }
  (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = Rec;
}
function removeVoice() { delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition; }

describe("Ask Knowvia panel, voice first", () => {
  afterEach(() => { removeVoice(); heard = ""; document.documentElement.removeAttribute("data-motion"); });

  const openVoice = async () => {
    installVoice();
    shell();
    await flush();
    fireEvent.click(dockBtn());
    return await screen.findByRole("dialog", { name: "Ask Knowvia" });
  };

  it("opens in voice with a named mic and a named arrow, and prints no key caps", async () => {
    const dialog = await openVoice();
    expect(dialog.getAttribute("data-view")).toBe("voice");
    expect(within(dialog).getByRole("button", { name: "Talk to Knowvia" })).toHaveAttribute("aria-pressed", "true");
    const arrow = within(dialog).getByRole("button", { name: "Open chat" });
    expect(arrow).toHaveAttribute("aria-expanded", "false");
    expect(dialog.querySelector("kbd")).toBeNull();
    expect(within(dialog).queryByRole("textbox")).toBeNull();
  });

  it("the arrow expands to chat, points back down, and Esc folds back to voice", async () => {
    const dialog = await openVoice();
    fireEvent.click(within(dialog).getByRole("button", { name: "Open chat" }));
    expect(dialog.getAttribute("data-view")).toBe("chat");
    const back = within(dialog).getByRole("button", { name: "Back to voice" });
    expect(back).toHaveAttribute("aria-expanded", "true");
    const input = await within(dialog).findByRole("textbox", { name: "Message to Ask Knowvia" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(within(dialog).getByRole("button", { name: "Talk to Knowvia" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialog.getAttribute("data-view")).toBe("voice");
    expect(within(dialog).getByRole("button", { name: "Open chat" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ask Knowvia" })).toBeNull());
  });

  it("keeps the transcript across voice and chat, and spoken words land in the thread", async () => {
    heard = "Who is on my family?";
    const dialog = await openVoice();
    fireEvent.click(within(dialog).getByRole("button", { name: "Talk to Knowvia" })); // stop and send
    await waitFor(() => expect(within(dialog).getByText("Who is on my family?")).toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("button", { name: "Open chat" }));
    const log = await within(dialog).findByRole("log");
    expect(within(log).getByText("Who is on my family?")).toBeInTheDocument();
    await waitFor(() => expect(log.querySelectorAll("p").length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    fireEvent.click(within(dialog).getByRole("button", { name: "Back to voice" }));
    expect(dialog.getAttribute("data-view")).toBe("voice");
    expect(within(within(dialog).getAllByRole("status")[0] as HTMLElement).getByText("Who is on my family?")).toBeInTheDocument();
  });

  it("works from the keyboard: Enter on the arrow opens chat and typing sends", async () => {
    const dialog = await openVoice();
    const arrow = within(dialog).getByRole("button", { name: "Open chat" });
    arrow.focus();
    fireEvent.click(arrow); // Enter and Space on a button fire click
    const input = await within(dialog).findByRole("textbox", { name: "Message to Ask Knowvia" });
    expect(within(dialog).getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(within(within(dialog).getByRole("log")).getByText("Hello")).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("closes from the Close button", async () => {
    const dialog = await openVoice();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ask Knowvia" })).toBeNull());
  });

  it("drops the bobbing arrow animation under reduced motion (static, instant switch)", async () => {
    document.documentElement.setAttribute("data-motion", "reduced");
    const css = readFileSync(path.resolve(__dirname, "../src/components/agent/AskPanel.module.css"), "utf8");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.chev[^}]*animation: none/);
    expect(css).toMatch(/html\[data-motion="reduced"\] \.chev[^}]*animation: none/);
    expect(css).toMatch(/html\[data-motion="reduced"\] \.chatWrap[^}]*transition: none/);
    const dialog = await openVoice();
    fireEvent.click(within(dialog).getByRole("button", { name: "Open chat" }));
    expect(dialog.getAttribute("data-view")).toBe("chat"); // switch is synchronous, no timers
  });
});

describe("Ask Knowvia panel, entry points", () => {
  afterEach(() => { removeVoice(); cleanup(); });

  it("without speech support the dock opens straight into chat with a short note", async () => {
    shell();
    await flush();
    fireEvent.click(dockBtn());
    const dialog = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    expect(dialog.getAttribute("data-view")).toBe("chat");
    expect(await within(dialog).findByRole("textbox", { name: "Message to Ask Knowvia" })).toBeInTheDocument();
    expect(dialog.querySelector("kbd")).toBeNull();
  });

  it("the knowvia:ask event opens chat expanded and answers", async () => {
    installVoice();
    shell();
    await flush();
    act(() => { window.dispatchEvent(new CustomEvent("knowvia:ask", { detail: { text: "Who is on my family?" } })); });
    const dialog = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    expect(dialog.getAttribute("data-view")).toBe("chat");
    const log = await within(dialog).findByRole("log");
    expect(within(log).getByText("Who is on my family?")).toBeInTheDocument();
  });

  it("keeps the thread after the panel is closed and reopened", async () => {
    shell();
    await flush();
    fireEvent.click(dockBtn());
    const dialog = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    const input = await within(dialog).findByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ask Knowvia" })).toBeNull());
    fireEvent.click(dockBtn());
    const again = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    expect(await within(again).findByText("Hello")).toBeInTheDocument();
  });

  it("offers at most three starter questions", async () => {
    shell();
    await flush();
    fireEvent.click(dockBtn());
    const dialog = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    await within(dialog).findByRole("textbox");
    expect(dialog.querySelectorAll("button[class*=starter]").length).toBeLessThanOrEqual(3);
  });
});

describe("motion helper", () => {
  it("caps the stagger index and ignores bad input", () => {
    expect((stagger(3) as Record<string, number>)["--i"]).toBe(3);
    expect((stagger(99) as Record<string, number>)["--i"]).toBe(8);
    expect((stagger(-2) as Record<string, number>)["--i"]).toBe(0);
    expect((stagger(NaN) as Record<string, number>)["--i"]).toBe(0);
  });
});
