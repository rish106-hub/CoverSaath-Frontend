// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ThemeProvider } from "@/components/theme";
import { AppShell } from "@/components/shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/compare",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const shell = (pathname: string) => render(<ThemeProvider><AppShell pathname={pathname}><p>body</p></AppShell></ThemeProvider>);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

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
