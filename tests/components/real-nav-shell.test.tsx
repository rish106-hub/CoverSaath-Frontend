// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const me = vi.hoisted(() => ({ state: { status: "ready", me: { source: "backend" } } as unknown }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: me.state, retry: vi.fn() }) }));
vi.mock("@/components/shell/UserChip", () => ({ UserChip: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/policies", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

import { AppSidebar } from "@/components/shell/AppSidebar";
import { PageHeader } from "@/components/shell/PageHeader";

afterEach(cleanup);
const hrefs = () => Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));

describe("shell nav by account kind", () => {
  it("real account: no dead-end links, Emergency goes to /hospitals", async () => {
    me.state = { status: "ready", me: { source: "backend" } };
    render(<AppSidebar pathname="/policies" />);
    render(<PageHeader pathname="/chat" />);
    await act(async () => {});
    const h = hrefs();
    for (const x of ["/assistant", "/cards", "/desk", "/shortcuts", "/review", "/emergency"]) expect(h).not.toContain(x);
    expect(h).toContain("/hospitals");
    expect(screen.getByText("Emergency").closest("a")).toHaveAttribute("href", "/hospitals");
    expect(screen.queryByRole("button", { name: "Help" })).toBeNull();
  });

  it("session still loading: demo-only links do not flash", async () => {
    me.state = { status: "loading" };
    render(<AppSidebar pathname="/policies" />);
    await act(async () => {});
    expect(hrefs()).not.toContain("/assistant");
  });

  it("demo account: nav unchanged", async () => {
    me.state = { status: "ready", me: { source: "mock" } };
    render(<AppSidebar pathname="/policies" />);
    await act(async () => {});
    const h = hrefs();
    for (const x of ["/assistant", "/cards", "/desk", "/review", "/emergency"]) expect(h).toContain(x);
    expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
  });
});
