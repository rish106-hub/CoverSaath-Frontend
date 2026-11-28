// @vitest-environment jsdom
// R2 shell: five-place rail, sub-tabs, ask bar, laptop gate, palette filter and shell-state copy.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PAGES, RAIL, navHref, railFor } from "@/lib/ia";

const nav = vi.hoisted(() => ({ path: "/home", push: vi.fn() }));
const me = vi.hoisted(() => ({ state: { status: "ready", me: { source: "mock" } } as unknown }));
const agent = vi.hoisted(() => ({ setPaletteOpen: vi.fn(), open: vi.fn(), submit: vi.fn(), paletteOpen: true }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: me.state, retry: vi.fn() }), invalidateMe: vi.fn() }));
vi.mock("@/components/shell/UserChip", () => ({ UserChip: () => <div data-testid="user-chip" /> }));
vi.mock("@/adapters/covers", () => ({ backendCovers: { holdingsView: () => Promise.resolve({ holdings: [{ id: "h1" }] }) } }));
vi.mock("@/adapters", () => ({
  adapters: { household: { household: () => Promise.resolve({ members: [] }) }, document: { list: () => Promise.resolve([]) } },
}));
// AppShell tests keep the real AskBar and stub the rest of the agent layer, so the search button can be checked against a spy.
vi.mock("@/components/agent", async () => {
  const real = await vi.importActual<typeof import("@/components/agent/AskBar")>("@/components/agent/AskBar");
  return {
    AgentProvider: ({ children }: { children: unknown }) => <>{children as never}</>,
    AgentLayer: () => null,
    HeaderMic: () => null,
    AskBar: real.AskBar,
    useAgent: () => agent,
  };
});
vi.mock("@/components/agent/AgentProvider", () => ({ useAgent: () => agent, AgentProvider: ({ children }: { children: unknown }) => <>{children as never}</> }));

import { AppSidebar } from "@/components/shell/AppSidebar";
import { PageHeader } from "@/components/shell/PageHeader";
import { AppShell } from "@/components/shell/AppShell";
import { ViewportGate } from "@/components/shell/ViewportGate";
import { BackendDown } from "@/components/shell/BackendDown";
import { ErrorPanel } from "@/components/shell/ErrorPanel";
import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { AskBar } from "@/components/agent/AskBar";
import { CommandPalette } from "@/components/palette/CommandPalette";

beforeAll(() => {
  // cmdk (the palette) needs these browser APIs, which jsdom does not provide.
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver = class { constructor(_onResize: ResizeObserverCallback) {} observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  nav.path = "/home";
  nav.push.mockClear();
  agent.setPaletteOpen.mockClear();
  me.state = { status: "ready", me: { source: "mock" } };
});
afterEach(cleanup);

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const sidebarAt = async (path: string) => {
  render(<AppSidebar pathname={path} />);
  await flush();
  return screen.getByRole("complementary", { name: "Knowvia" });
};
const currentLabels = (root: HTMLElement) => Array.from(root.querySelectorAll('[aria-current="page"]')).map((e) => e.textContent);

describe("AppSidebar", () => {
  it("AppSidebar markup order", async () => {
    const side = await sidebarAt("/home");
    expect(side.id).toBe("app-sidebar");
    const brand = within(side).getByRole("link", { name: "Knowvia home" });
    const add = within(side).getByRole("link", { name: "Add a policy" });
    const rail = within(side).getByRole("navigation", { name: "Knowvia sections" });
    const emergency = within(side).getByRole("link", { name: "Emergency" });
    const settings = within(side).getByRole("link", { name: "Settings" });
    const chip = within(side).getByTestId("user-chip");
    expect(add).toHaveAttribute("data-testid", "rail-add");
    expect(add).toHaveAttribute("href", "/covers/add");
    expect(settings).toHaveAttribute("href", "/settings");
    const links = within(rail).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Home", "My policies", "Ask", "Family", "Money"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(RAIL.map((p) => p.href));
    const order = [brand, add, rail, emergency, settings, chip];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING, `element ${i}`).toBeTruthy();
    }
  });

  it("AppSidebar aria-current follows railFor", async () => {
    for (const [path, label] of [["/policies/abc", "My policies"], ["/covers/declarations", "Family"], ["/chat", "Ask"]]) {
      cleanup();
      await sidebarAt(path);
      const marked = within(screen.getByRole("navigation", { name: "Knowvia sections" })).getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
      expect(marked.map((l) => l.textContent), path).toEqual([label]);
    }
    cleanup();
    await sidebarAt("/emergency");
    const none = within(screen.getByRole("navigation", { name: "Knowvia sections" })).getAllByRole("link").filter((l) => l.hasAttribute("aria-current"));
    expect(none).toHaveLength(0);
  });

  it("AppSidebar Emergency and Settings aria-current", async () => {
    const emergencyPage = PAGES.find((p) => p.route === "/emergency")!;
    for (const [source, audience] of [["mock", "demo"], ["backend", "real"]] as const) {
      cleanup();
      me.state = { status: "ready", me: { source } };
      await sidebarAt("/emergency");
      const emergency = screen.getByRole("link", { name: "Emergency" });
      expect(emergency).toHaveAttribute("aria-current", "page");
      expect(emergency).toHaveAttribute("href", navHref(emergencyPage, audience));
      expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
    }
    cleanup();
    await sidebarAt("/settings");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Emergency" })).not.toHaveAttribute("aria-current");
    cleanup();
    await sidebarAt("/home");
    expect(screen.getByRole("link", { name: "Emergency" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
  });

  it("AppSidebar has no group headings, collapse, today, reading list or drawer", async () => {
    const side = await sidebarAt("/home");
    expect(side.querySelector("[aria-expanded]")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(screen.queryByTestId("sidebar-scrim")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Today|Reading list/);
    for (const g of ["My cover", "My family", "My money", "Help"]) expect(within(side).queryByText(g)).toBeNull();
  });
});

describe("PageHeader", () => {
  const tabsAt = (path: string) => {
    cleanup();
    render(<PageHeader pathname={path} />);
    return screen.queryByTestId("page-subtabs");
  };

  it("PageHeader renders sub-tabs for the current place", () => {
    const nav1 = tabsAt("/compare")!;
    expect(nav1.tagName).toBe("NAV");
    expect(nav1).toHaveAttribute("aria-label", "My policies");
    const links = within(nav1).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["All policies", "Compare", "Stress test", "Hospitals"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/policies", "/compare", "/stress-test", "/hospitals"]);
    expect(links.filter((l) => l.getAttribute("aria-current") === "page").map((l) => l.textContent)).toEqual(["Compare"]);
  });

  it("PageHeader policies sub-path marks All policies current", () => {
    const detail = tabsAt("/policies/abc")!;
    expect(currentLabels(detail)).toEqual(["All policies"]);
    const add = tabsAt("/covers/add")!;
    expect(add).toHaveAttribute("aria-label", "My policies");
    expect(currentLabels(add)).toEqual([]);
  });

  it("PageHeader family and money tabs", () => {
    const family = tabsAt("/covers/declarations")!;
    expect(family).toHaveAttribute("aria-label", "Family");
    expect(within(family).getAllByRole("link").map((l) => l.textContent)).toEqual(["People", "Cover memory", "Health details"]);
    expect(currentLabels(family)).toEqual(["Health details"]);
    const money = tabsAt("/money")!;
    expect(money).toHaveAttribute("aria-label", "Money");
    expect(within(money).getAllByRole("link").map((l) => l.textContent)).toEqual(["Premiums", "Calculators"]);
    expect(currentLabels(money)).toEqual(["Premiums"]);
  });

  it("PageHeader renders nothing without tabs", () => {
    for (const path of ["/home", "/chat", "/emergency", "/settings", "/nope"]) {
      expect(tabsAt(path), path).toBeNull();
    }
  });
});

describe("AppShell", () => {
  it("AppShell renders AskBar, search button and ViewportGate", async () => {
    const { container } = render(<AppShell pathname="/home"><p>body</p></AppShell>);
    await flush();
    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    const form = screen.getByRole("search", { name: "Ask about your cover" });
    expect(mains[0].compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mains[0].contains(form)).toBe(false);
    const search = screen.getByRole("button", { name: /Search or jump to/ });
    expect(search.textContent).toContain("⌘K");
    const shellRoot = container.querySelector("[data-group]") as HTMLElement;
    const gate = screen.getByTestId("viewport-gate");
    expect(shellRoot.contains(gate)).toBe(false);
    expect(gate.closest("[data-group]")).toBeNull();
  });

  it("AppShell search button calls setPaletteOpen", async () => {
    render(<AppShell pathname="/home"><p>body</p></AppShell>);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /Search or jump to/ }));
    expect(agent.setPaletteOpen).toHaveBeenCalledTimes(1);
    expect(agent.setPaletteOpen).toHaveBeenCalledWith(true);
  });
});

describe("AskBar", () => {
  const input = () => screen.getByRole("textbox", { name: "Ask about your cover" }) as HTMLInputElement;

  it("AskBar structure", () => {
    render(<AskBar />);
    expect(screen.getByRole("search", { name: "Ask about your cover" })).toBeInTheDocument();
    expect(input()).toHaveAttribute("placeholder", "Ask about your cover");
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(ask.textContent).toContain("→");
  });

  it("AskBar submit pushes encoded query and clears input", () => {
    render(<AskBar />);
    fireEvent.change(input(), { target: { value: "knee surgery & cost?" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push).toHaveBeenCalledWith("/chat?q=knee%20surgery%20%26%20cost%3F");
    expect(input().value).toBe("");
  });

  it("AskBar empty submit focuses input and does nothing", () => {
    render(<AskBar />);
    fireEvent.submit(screen.getByRole("search"));
    expect(nav.push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input());
    (document.activeElement as HTMLElement).blur();
    fireEvent.change(input(), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(nav.push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input());
  });

  it("AskBar renders nothing on chat and emergency", () => {
    for (const path of ["/chat", "/chat/anything", "/emergency"]) {
      cleanup();
      nav.path = path;
      render(<AskBar />);
      expect(screen.queryByRole("search"), path).toBeNull();
    }
    for (const path of ["/home", "/policies", "/emergency-contacts"]) {
      cleanup();
      nav.path = path;
      render(<AskBar />);
      expect(screen.queryByRole("search"), path).not.toBeNull();
    }
  });
});

describe("ViewportGate", () => {
  it("ViewportGate text", () => {
    render(<ViewportGate />);
    const gate = screen.getByTestId("viewport-gate");
    expect(within(gate).getByRole("heading", { level: 1 }).textContent).toBe("Open Knowvia on a laptop.");
    expect(within(gate).getByText("Sign in there with the same account. Your cover is waiting.").tagName).toBe("P");
    expect(within(gate).getByRole("link", { name: "Knowvia home" }).querySelector("img")).not.toBeNull();
  });
});

describe("CommandPalette", () => {
  const demoOnlyPages = PAGES.filter((p) => p.demoOnly && !p.route.includes("["));
  // "Ask Knowvia" is also the name of a fixed palette action, so one extra option with that name is always there.
  const optionCount = (tab: string) => screen.queryAllByRole("option", { name: tab }).length;

  it("CommandPalette skips demoOnly pages unless demo audience", async () => {
    expect(demoOnlyPages.length).toBeGreaterThan(0);
    me.state = { status: "ready", me: { source: "backend" } };
    render(<CommandPalette />);
    await flush();
    for (const p of demoOnlyPages) expect(optionCount(p.tab), `real ${p.route}`).toBe(p.tab === "Ask Knowvia" ? 1 : 0);
    cleanup();
    me.state = { status: "ready", me: { source: "mock" } };
    render(<CommandPalette />);
    await flush();
    for (const p of demoOnlyPages) expect(optionCount(p.tab), `demo ${p.route}`).toBe(p.tab === "Ask Knowvia" ? 2 : 1);
  });

  it("CommandPalette has no theme switch action", async () => {
    for (const source of ["backend", "mock"]) {
      cleanup();
      me.state = { status: "ready", me: { source } };
      render(<CommandPalette />);
      await flush();
      expect(screen.queryAllByRole("option", { name: /light and dark/i }), source).toHaveLength(0);
    }
  });
});

describe("Shell state copy", () => {
  it("Shell state copy", async () => {
    const copy = (container: HTMLElement) => expect(container.textContent).not.toMatch(/safe|coming soon/i);

    const down = render(<BackendDown onRetry={() => {}} />);
    expect(screen.getByRole("heading", { name: "Knowvia is not answering." })).toBeInTheDocument();
    expect(screen.getByText("This page will load when the service is back.")).toBeInTheDocument();
    copy(down.container);
    cleanup();

    const panel = render(<ErrorPanel />);
    expect(screen.getByRole("heading", { name: "This page did not load." })).toBeInTheDocument();
    expect(screen.getByText("The rest of Knowvia is working.")).toBeInTheDocument();
    copy(panel.container);
    cleanup();

    me.state = { status: "down" };
    const unreachable = render(<DemoGate empty={null}><p>demo</p></DemoGate>);
    const box = screen.getByTestId("unreachable-state");
    expect(within(box).getByRole("heading", { name: "Knowvia is not answering." })).toBeInTheDocument();
    expect(within(box).getByText("This page will load when the service is back.")).toBeInTheDocument();
    copy(unreachable.container);
    cleanup();

    me.state = { status: "ready", me: { source: "backend" } };
    const owned = render(<DemoGate empty={<EmptyState title="Nothing yet" body="Add one." />}><p>demo</p></DemoGate>);
    const policy = await screen.findByRole("heading", { name: "Your policy is on Knowvia." });
    const section = policy.closest("section") as HTMLElement;
    expect(section.querySelectorAll("p")).toHaveLength(0);
    copy(owned.container);
  });
});

describe("railFor", () => {
  it("railFor maps every RAIL href and tab route", () => {
    const table: [string, string][] = [
      ["/home", "home"], ["/policies", "policies"], ["/compare", "policies"], ["/stress-test", "policies"], ["/hospitals", "policies"],
      ["/chat", "ask"], ["/family", "family"], ["/family/memory", "family"], ["/covers/declarations", "family"], ["/money", "money"], ["/tools", "money"],
    ];
    for (const [path, id] of table) {
      expect(railFor(path)?.id, path).toBe(id);
      expect(railFor(path + "/")?.id, `${path}/`).toBe(id);
    }
    for (const place of RAIL) {
      expect(railFor(place.href)?.id).toBe(place.id);
      for (const t of place.tabs) expect(railFor(t.route)?.id).toBe(place.id);
    }
  });

  it("railFor prefixes and no-place paths", () => {
    for (const path of ["/policies/abc", "/policies/abc/def", "/covers/add", "/covers/xyz"]) expect(railFor(path)?.id, path).toBe("policies");
    expect(railFor("/covers/declarations")?.id).toBe("family");
    for (const path of ["/emergency", "/settings", "/profile", "/nope", "/", ""]) expect(railFor(path), path).toBeUndefined();
    expect(railFor("/emergency/")).toBeUndefined();
  });
});
