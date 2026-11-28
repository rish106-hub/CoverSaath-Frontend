// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { PAGES, railFor } from "@/lib/ia";
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
  // /covers/add is the wizard: the shell renders it bare (no rail), covered in kv-wizard.test.tsx.
  it.each(PAGES.filter((p) => p.href !== "/covers/add").map((p) => [p.href, p] as const))("%s keeps one sidebar and marks the current page", async (href, p) => {
    const { container } = shell(href);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(container.querySelectorAll("aside")).toHaveLength(1);
    const side = container.querySelector("aside") as HTMLElement;
    expect(within(side).getByRole("navigation", { name: "Knowvia sections" })).toBeInTheDocument();
    const current = side.querySelectorAll('[aria-current="page"]');
    // One place is current: the rail place for the path, or Emergency or Settings; pages outside all of these mark nothing.
    const expected = railFor(href)?.label ?? (p.route === "/emergency" ? "Emergency" : p.route === "/settings" ? "Settings" : null);
    if (expected) {
      expect(current).toHaveLength(1);
      expect(current[0].textContent).toBe(expected);
    } else {
      expect(current).toHaveLength(0);
    }
  });

  it("highlights My policies on a nested policy route", () => {
    const { container } = shell("/policies/northstar-floater");
    const current = container.querySelector("aside [aria-current='page']");
    expect(current?.textContent).toBe("My policies");
  });

  it("skip link is the first focusable element and targets main", () => {
    const { container } = shell("/compare");
    const first = container.querySelector("a[href], button") as HTMLAnchorElement;
    expect(first.textContent).toBe("Skip to content");
    expect(first.getAttribute("href")).toBe("#main-content");
    expect(container.querySelector("main#main-content")).not.toBeNull();
  });

  it("page header shows sub-tabs of the place and no breadcrumb", () => {
    shell("/compare");
    expect(screen.queryByRole("navigation", { name: "Knowvia groups" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "My policies" })).toBeInTheDocument();
  });
});

describe("brand mark", () => {
  it("sidebar brand is the K mark image inside a labelled home link", () => {
    const { container } = shell("/home");
    const link = container.querySelector('aside a[aria-label="Knowvia home"]');
    expect(link).not.toBeNull();
    const img = link!.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/brand/knowvia-mark.svg");
    expect(img?.getAttribute("alt")).toBe("");
  });
});
