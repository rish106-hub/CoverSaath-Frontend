// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ThemeProvider } from "@/components/theme";
import { AppShell } from "@/components/shell";
import { NAV_CLOSED_KEY } from "@/components/shell/AppSidebar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/compare",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const shell = (pathname: string) => render(<ThemeProvider><AppShell pathname={pathname}><p>body</p></AppShell></ThemeProvider>);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const btn = (name: string) => screen.getByRole("button", { name });

describe("sidebar group buttons", () => {
  it("renders the four groups as buttons, all open by default", async () => {
    shell("/compare");
    await flush();
    for (const n of ["My cover", "My family", "My money", "Help"]) {
      expect(btn(n)).toHaveAttribute("aria-expanded", "true");
      expect(btn(n).getAttribute("aria-controls")).toBeTruthy();
    }
  });

  it("toggles a group, controls its links and remembers the choice", async () => {
    const first = shell("/compare");
    await flush();
    const family = btn("My family");
    fireEvent.click(family);
    expect(family).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(family.getAttribute("aria-controls")!)).toHaveAttribute("hidden");
    expect(JSON.parse(window.localStorage.getItem(NAV_CLOSED_KEY)!)).toEqual(["family"]);
    first.unmount();
    shell("/compare");
    await flush();
    expect(btn("My family")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn("My family"));
    expect(btn("My family")).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the group of the current page open even if stored closed", async () => {
    window.localStorage.setItem(NAV_CLOSED_KEY, JSON.stringify(["cover", "money"]));
    shell("/compare");
    await flush();
    expect(btn("My cover")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(btn("My cover"));
    expect(btn("My cover")).toHaveAttribute("aria-expanded", "true");
    expect(btn("My money")).toHaveAttribute("aria-expanded", "false");
  });

  it("survives blocked storage", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    shell("/compare");
    await flush();
    fireEvent.click(btn("Help"));
    expect(btn("Help")).toHaveAttribute("aria-expanded", "false");
    spy.mockRestore();
    set.mockRestore();
  });

  it("gives each group an accessible name and tooltip for the icon rail", async () => {
    shell("/compare");
    await flush();
    for (const n of ["My cover", "My family", "My money", "Help"]) {
      expect(btn(n).getAttribute("data-tip")).toBe(n);
      expect(btn(n).querySelector("svg")).not.toBeNull();
    }
  });
});

describe("data-group accent context", () => {
  it.each([["/compare", "cover"], ["/family", "family"], ["/money", "money"], ["/desk", "help"], ["/profile", "none"], ["/settings", "none"]])("%s sets data-group=%s", async (path, group) => {
    const { container } = shell(path);
    await flush();
    expect(container.firstElementChild).toHaveAttribute("data-group", group);
  });

  it("buttons.css maps each group to its token pair, without raw colours", () => {
    const css = readFileSync("src/styles/buttons.css", "utf8");
    for (const g of ["cover", "family", "money", "help"]) {
      expect(css).toMatch(new RegExp(`\\[data-group="${g}"\\][^}]*--btn-accent: var\\(--g-${g}\\)[^}]*--btn-accent-ink: var\\(--on-g\\)`));
    }
    expect(css).toMatch(/\.k-btn--primary \{[^}]*var\(--btn-accent\)/);
    expect(css).toMatch(/\.k-btn--danger \{[^}]*--signal-ink/);
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
