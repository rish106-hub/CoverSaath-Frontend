// @vitest-environment jsdom
// T2: <main> must survive navigation. A remount would replay the entrance and flash the page.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/policies" }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: { status: "loading" }, retry: vi.fn() }), invalidateMe: vi.fn() }));
vi.mock("@/components/shell/AppSidebar", () => ({ AppSidebar: () => null }));
vi.mock("@/components/shell/PageHeader", () => ({ PageHeader: () => null }));
vi.mock("@/components/agent", () => ({ AgentProvider: ({ children }: { children: unknown }) => <>{children as never}</>, AgentLayer: () => null, HeaderMic: () => null, AskBar: () => null, useAgent: () => ({ setPaletteOpen: vi.fn() }) }));

import { AppShell } from "@/components/shell/AppShell";

afterEach(cleanup);

describe("AppShell", () => {
  it("AppShell main has no key remount (same DOM node across rerender with new pathname)", () => {
    const { container, rerender } = render(<AppShell pathname="/home"><p>a</p></AppShell>);
    const before = container.querySelector("main");
    rerender(<AppShell pathname="/policies"><p>b</p></AppShell>);
    const after = container.querySelector("main");
    expect(after).toBe(before);
    expect(after?.className).toContain("k-content");
  });
});
