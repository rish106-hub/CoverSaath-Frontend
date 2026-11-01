// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme";
import { AppShell } from "@/components/shell";
import { stagger } from "@/lib/motion";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/compare",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => { cleanup(); document.documentElement.setAttribute("data-theme", "light"); });

const shell = () => render(<ThemeProvider><AppShell pathname="/compare"><p>body</p></AppShell></ThemeProvider>);
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

describe("Ask Knowvia text chat", () => {
  const openChat = async () => {
    shell();
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Ask Knowvia" }));
    return await screen.findByRole("dialog", { name: "Ask Knowvia chat" });
  };

  it("opens from the dock, sends with Enter and shows the reply in the thread", async () => {
    const dialog = await openChat();
    const input = within(dialog).getByRole("textbox", { name: "Message to Ask Knowvia" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(within(dialog).getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "Who is on my family?" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    const log = within(dialog).getByRole("log");
    expect(within(log).getByText("Who is on my family?")).toBeInTheDocument();
    await waitFor(() => expect(log.querySelectorAll("p").length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("closes on Escape and keeps the thread for next time", async () => {
    const dialog = await openChat();
    const input = within(dialog).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ask Knowvia chat" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Ask Knowvia" }));
    const again = await screen.findByRole("dialog", { name: "Ask Knowvia chat" });
    expect(within(again).getByText("Hello")).toBeInTheDocument();
  });

  it("offers at most three starter questions and no printed shortcut hints", async () => {
    const dialog = await openChat();
    expect(dialog.querySelectorAll("button[class*=starter]").length).toBeLessThanOrEqual(3);
    expect(dialog.querySelector("kbd")).toBeNull();
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
