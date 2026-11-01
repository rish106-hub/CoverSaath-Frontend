// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ThemeProvider } from "@/components/theme";
import { AppShell } from "@/components/shell";
import { PAGES } from "@/lib/ia";
import { resolveNavigation } from "@/agent/navigate";
import { commandsFor, VOICE_COMMANDS } from "@/agent/voice-commands";

const push = vi.fn();
let pathname = "/family";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => { push.mockClear(); pathname = "/family"; window.localStorage.clear(); });
afterEach(() => { cleanup(); delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition; document.documentElement.removeAttribute("data-motion"); });

const shell = () => render(<ThemeProvider><AppShell pathname={pathname}><p>body</p></AppShell></ThemeProvider>);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const dock = () => document.querySelector<HTMLElement>("[data-ask-trigger]") as HTMLElement;
function installVoice() {
  class Rec { lang = ""; interimResults = false; continuous = false; onresult: unknown = null; onend: (() => void) | null = null; onerror: unknown = null; start() {} stop() { this.onend?.(); } abort() {} }
  (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = Rec;
}
const css = (f: string) => readFileSync(path.resolve(__dirname, "../src/components/agent", f), "utf8");

describe("dock", () => {
  it("is a labelled voice button with a mic and a sound wave", async () => {
    shell(); await flush();
    const d = dock();
    expect(d.tagName).toBe("BUTTON");
    expect(d.textContent).toContain("Talk to Knowvia");
    expect(screen.getAllByRole("button", { name: "Talk to Knowvia" })).toContain(d);
    expect(d.querySelector("svg")).not.toBeNull();
    expect(d.querySelector("[class*=wave]")).not.toBeNull();
  });
  it("stops the wave and the breathing ring under reduced motion", () => {
    const c = css("agent.module.css");
    expect(c).toMatch(/prefers-reduced-motion: reduce\)[^\n]*\.wave i[^}]*animation: none/);
    expect(c).toMatch(/html\[data-motion="reduced"\] \.wave i[^}]*animation: none/);
    expect(c).toMatch(/html\[data-motion="reduced"\] \.dockMic::after[^}]*animation: none/);
  });
});

describe("header mic", () => {
  it("sits in the top bar beside the theme button and opens voice mode", async () => {
    installVoice();
    shell(); await flush();
    const mic = screen.getAllByRole("button", { name: "Talk to Knowvia" }).find((b) => b !== dock() && !b.closest("[role=dialog]")) as HTMLElement;
    expect(mic.parentElement).toBe(screen.getByRole("button", { name: "Switch to dark theme" }).parentElement);
    fireEvent.click(mic);
    const dialog = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    expect(dialog.getAttribute("data-view")).toBe("voice");
  });
});

describe("coach card", () => {
  it("shows on the first two visits only", async () => {
    for (const visit of [1, 2]) {
      shell(); await flush();
      expect(screen.getByRole("dialog", { name: /Talk to Knowvia/ }), `visit ${visit}`).toBeInTheDocument();
      cleanup();
    }
    shell(); await flush();
    expect(screen.queryByText(/Say what you need, it can open pages/)).toBeNull();
  });
  it("has Try it and Not now, and Esc dismisses it for good", async () => {
    shell(); await flush();
    const card = screen.getByRole("dialog", { name: /Talk to Knowvia/ });
    expect(within(card).getByRole("button", { name: "Try it" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Not now" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(/Say what you need, it can open pages/)).toBeNull();
    cleanup(); shell(); await flush();
    expect(screen.queryByText(/Say what you need, it can open pages/)).toBeNull();
  });
  it("Try it opens the panel in voice mode", async () => {
    installVoice();
    shell(); await flush();
    fireEvent.click(screen.getByRole("button", { name: "Try it" }));
    const dialog = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    expect(dialog.getAttribute("data-view")).toBe("voice");
    expect(screen.queryByText(/Say what you need, it can open pages/)).toBeNull();
  });
});

describe("voice suggestions", () => {
  it("shows three quoted commands for the page and tapping one runs it", async () => {
    installVoice();
    shell(); await flush();
    fireEvent.click(dock());
    const dialog = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    for (const c of ["Add my father", "Show who is covered", "Open money desk"]) expect(within(dialog).getByRole("button", { name: `“${c}”` })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "“Open money desk”" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/money"));
    expect(within(dialog).getAllByText("Opening Money desk").length).toBeGreaterThan(0);
  });
  it("has three commands for every page", () => {
    for (const p of PAGES) expect(commandsFor(p.href)).toHaveLength(3);
    for (const v of Object.values(VOICE_COMMANDS)) for (const c of v) expect(c).toMatch(/^[A-Z]/);
  });
});

describe("voice navigation", () => {
  it("every page is reachable by its tab name, 'open X' and 'go to my X'", () => {
    for (const p of PAGES.filter((x) => !x.route.includes("["))) {
      const tab = p.tab.toLowerCase();
      for (const say of [`open ${tab}`, `go to ${tab}`, `show ${tab}`, `take me to the ${tab}`]) expect(resolveNavigation(say)?.route, say).toBe(p.route);
    }
  });
  it("understands the common phrasings", () => {
    expect(resolveNavigation("open family")?.route).toBe("/family");
    expect(resolveNavigation("go to my money")?.route).toBe("/money");
    expect(resolveNavigation("show compare")?.route).toBe("/compare");
    expect(resolveNavigation("Take me home")?.route).toBe("/home");
    expect(resolveNavigation("open my family")?.label).toBe("My family");
  });
  it("leaves questions alone", () => {
    expect(resolveNavigation("Show who is covered")).toBeUndefined();
    expect(resolveNavigation("Is Mumma’s cataract covered?")).toBeUndefined();
    expect(resolveNavigation("hello")).toBeUndefined();
  });
  it("navigates with router.push and confirms in the panel", async () => {
    shell(); await flush();
    fireEvent.click(dock());
    const dialog = await screen.findByRole("dialog", { name: "Ask Knowvia" });
    const input = await within(dialog).findByRole("textbox");
    fireEvent.change(input, { target: { value: "open my family" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(push).toHaveBeenCalledWith("/family");
    expect(await within(dialog).findByText("Opening My family")).toBeInTheDocument();
  });
});
