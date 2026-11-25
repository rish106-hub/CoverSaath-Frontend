// @vitest-environment jsdom
// Issue #112: loading, empty and error states for chat, declarations, home (backend down) and the page skeleton.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

const h = vi.hoisted(() => ({
  holdings: (() => Promise.resolve([])) as () => Promise<unknown[]>,
  members: (() => Promise.resolve([])) as () => Promise<unknown[]>,
  me: { status: "down" } as { status: string },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/chat" }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: h.me, retry: vi.fn() }) }));
vi.mock("@/adapters", () => ({
  adapters: {
    covers: { holdings: () => h.holdings(), declarations: async () => [], premiums: async () => [] },
    members: { list: () => h.members() },
    chat: { consent: async () => true, startThread: vi.fn(), turn: vi.fn(), grantConsent: vi.fn(), revokeConsent: vi.fn() },
    voice: { supported: () => false, listen: vi.fn(), stop: vi.fn() },
  },
}));

import { ChatView } from "@/components/chat/ChatView";
import { DeclarationsView } from "@/components/covers/DeclarationsView";
import { HomeGreeting } from "@/components/shell/HomeGreeting";
import { PageSkeleton } from "@/components/shell/ErrorPanel";

afterEach(() => { cleanup(); h.holdings = () => Promise.resolve([]); h.members = () => Promise.resolve([]); h.me = { status: "down" }; });

describe("chat with no cover (row 7)", () => {
  it("shows a loading line while holdings load, then No policy yet with an Add a policy link", async () => {
    let release!: (v: unknown[]) => void;
    h.holdings = () => new Promise((r) => { release = r; });
    render(<ChatView />);
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.queryByText("No policy yet")).toBeNull();
    release([]);
    expect(await screen.findByText("No policy yet")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("link", { name: "Add a policy" }).getAttribute("href")).toBe("/covers/add");
  });

  it("does not show No policy yet when a cover exists", async () => {
    h.holdings = () => Promise.resolve([{ id: "h1", status: "ready" }]);
    render(<ChatView />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByText("No policy yet")).toBeNull();
  });
});

describe("declarations while members load (row 10)", () => {
  it("shows loading, not the add-people prompt, until members resolve", async () => {
    let release!: (v: unknown[]) => void;
    h.members = () => new Promise((r) => { release = r; });
    render(<DeclarationsView />);
    expect(screen.getByText("Loading the people on this policy…")).toBeTruthy();
    expect(screen.queryByText(/Add the people on this policy first/)).toBeNull();
    release([]);
    expect(await screen.findByText(/Add the people on this policy first/)).toBeTruthy();
    expect(screen.queryByText("Loading the people on this policy…")).toBeNull();
  });

  it("shows the person list and no prompt when members exist", async () => {
    h.members = () => Promise.resolve([{ id: "m1", name: "Asha" }]);
    render(<DeclarationsView />);
    expect(await screen.findByRole("option", { name: "Asha" })).toBeTruthy();
    expect(screen.queryByText(/Add the people on this policy first/)).toBeNull();
  });
});

describe("home when the backend is down (row 27)", () => {
  it("keeps the h1 greeting and renders the notice below as an h2", () => {
    const { container } = render(<HomeGreeting />);
    const h1 = container.querySelector("h1");
    const h2 = screen.getByRole("heading", { level: 2, name: /Can’t reach Knowvia/ });
    expect(h1?.textContent).toMatch(/^Good (morning|afternoon|evening)\.$/);
    expect(container.querySelectorAll("h3").length).toBe(0);
    expect(h1!.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("loading skeleton (row 28)", () => {
  it("is a status region with screen-reader text", () => {
    render(<PageSkeleton />);
    const box = screen.getByRole("status");
    expect(box.getAttribute("aria-busy")).toBe("true");
    expect(box.querySelector(".sr-only")?.textContent).toBe("Loading");
  });

  it("paints the bars and block with --line at full opacity", () => {
    const css = readFileSync("src/components/shell/ErrorPanel.module.css", "utf8");
    for (const sel of [".bar", ".block"]) {
      const rule = css.match(new RegExp(`^\\${sel} \\{([^}]*)\\}`, "m"))![1];
      expect(rule).toMatch(/background:\s*var\(--line\)/);
      expect(rule).not.toMatch(/opacity/);
    }
  });
});
