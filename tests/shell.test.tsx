// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PAGES } from "@/lib/ia";
import { ThemeProvider } from "@/components/theme";
import { AppShell } from "@/components/shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

const shell = (pathname: string) =>
  render(<ThemeProvider><AppShell pathname={pathname}><p>body</p></AppShell></ThemeProvider>);

describe("app shell sidebar", () => {
  it.each(PAGES.map((p) => [p.href, p] as const))("%s keeps one sidebar and marks the current page", async (href, p) => {
    const { container } = shell(href);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(container.querySelectorAll("aside")).toHaveLength(1);
    const side = container.querySelector("aside") as HTMLElement;
    expect(within(side).getByRole("navigation", { name: "Knowvia sections" })).toBeInTheDocument();
    const current = side.querySelectorAll('[aria-current="page"]');
    if (p.group) {
      expect(current).toHaveLength(1);
      expect(current[0].textContent).toContain(p.tab);
    } else {
      expect(current).toHaveLength(0);
    }
  });

  it("highlights My policies on a nested policy route", () => {
    const { container } = shell("/policies/northstar-floater");
    const current = container.querySelector("aside [aria-current='page']");
    expect(current?.textContent).toBe("My policies");
  });

  it("shows Today and Reading list only on home", () => {
    const home = shell("/home");
    expect(home.container.querySelector("aside")?.textContent).toContain("Reading list");
    cleanup();
    const other = shell("/compare");
    expect(other.container.querySelector("aside")?.textContent).not.toContain("Reading list");
  });

  it("skip link is the first focusable element and targets main", () => {
    const { container } = shell("/compare");
    const first = container.querySelector("a[href], button") as HTMLAnchorElement;
    expect(first.textContent).toBe("Skip to content");
    expect(first.getAttribute("href")).toBe("#main-content");
    expect(container.querySelector("main#main-content")).not.toBeNull();
  });

  it("page header no longer repeats the group switch", () => {
    shell("/compare");
    expect(screen.queryByRole("navigation", { name: "Knowvia groups" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("drawer opens, Esc closes and returns focus, route change closes", () => {
    const { rerender } = shell("/compare");
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    const side = document.querySelector("aside") as HTMLElement;
    expect(side.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(menu);

    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    rerender(<ThemeProvider><AppShell pathname="/money"><p>body</p></AppShell></ThemeProvider>);
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  it("traps Tab inside the open drawer", () => {
    shell("/compare");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const side = document.querySelector("aside") as HTMLElement;
    const items = Array.from(side.querySelectorAll<HTMLElement>("a[href], button"));
    items[items.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });
});
