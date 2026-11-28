// @vitest-environment jsdom
// R3s: a real account never sees a "Coming soon" tile, a Soon button or an eyebrow caption above a page title.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { adapters } from "@/adapters";
import { backendCovers } from "@/adapters/covers";
import { invalidateMe } from "@/components/shell/useMe";
import { ThemeProvider } from "@/components/theme";
import { HelpHead } from "@/components/help/HelpHead";
import { PagePlaceholder } from "@/components/shell/PagePlaceholder";
import { SettingsView } from "@/components/help/SettingsView";
import DeskP from "@/app/(app)/desk/page";
import CardsP from "@/app/(app)/cards/page";
import { PAGES } from "@/lib/ia";

// SettingsView calls useRouter, which needs a mounted app router outside a real page.
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn() }), usePathname: () => "/settings" }));

const ME = { householdId: "h", householdName: "H", owner: { id: "o", displayName: "Owner" }, source: "backend" as const };

/** Every source file under the app route group, so a new page cannot bring a Soon block back unnoticed. */
function pageSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? pageSources(path) : /\.(ts|tsx)$/.test(name) ? [readFileSync(path, "utf8")] : [];
  });
}

beforeEach(() => {
  invalidateMe();
  vi.spyOn(adapters.household, "me").mockResolvedValue(ME);
  vi.spyOn(adapters.members, "list").mockResolvedValue([]);
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: [], creationIssues: [] } as never);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("R3s no Coming soon and no eyebrow captions", () => {
  it("no page under src/app/(app) imports SoonBento", () => {
    const sources = pageSources(join(process.cwd(), "src/app/(app)"));
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) expect(source).not.toContain("SoonBento");
  });

  it("no page under src/app/(app) renders a Kicker", () => {
    for (const source of pageSources(join(process.cwd(), "src/app/(app)"))) expect(source).not.toContain("Kicker");
  });

  it("HelpHead and PagePlaceholder render the title without a kicker", () => {
    const route = PAGES.find((p) => p.kicker)?.route ?? "/desk";
    const page = PAGES.find((p) => p.route === route);
    expect(page?.kicker).toBeTruthy();
    const { container } = render(<><HelpHead route={route} /><PagePlaceholder route={route} /></>);
    expect(screen.getAllByText(page!.title).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain(page!.kicker as string);
  });

  it("desk and cards show This page is not available with a link to Home for a real account", async () => {
    for (const Page of [DeskP, CardsP]) {
      const { unmount } = render(<Page />);
      expect(await screen.findByText("This page is not available.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/home");
      expect(document.querySelector('[title="Coming soon"]')).toBeNull();
      unmount();
    }
  });

  it("settings has no Voice language row and no Soon button", async () => {
    const { container } = render(<ThemeProvider><SettingsView logos={{ digilocker: null, abha: null }} /></ThemeProvider>);
    await screen.findByText("Reduce motion");
    expect(container.textContent).not.toContain("Voice language");
    expect(container.querySelector('[title="Coming soon"]')).toBeNull();
  });

  it("the ia registry still carries its kicker fields", () => {
    expect(PAGES.filter((p) => p.kicker).length).toBeGreaterThan(0);
  });
});
