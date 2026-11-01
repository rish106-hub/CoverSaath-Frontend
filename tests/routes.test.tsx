// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ONBOARDING_ROUTES, PAGES, PUBLIC_ROUTES } from "@/lib/ia";
import { AgentProvider } from "@/components/agent";
import { ThemeProvider } from "@/components/theme";
import { PAGE_CONTEXT, contextFor } from "@/agent/page-registry";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error("notFound"); },
}));

/** Route pattern -> loader of the Next page module. /status is server-only and covered by the curl check. */
const PAGE_MODULES: Record<string, () => Promise<{ default: (p: never) => unknown }>> = {
  "/": () => import("@/app/page"),
  "/signin": () => import("@/app/signin/page"),
  "/welcome": () => import("@/app/welcome/page"),
  "/home": () => import("@/app/(app)/home/page"),
  "/policies": () => import("@/app/(app)/policies/page"),
  "/policies/[id]": () => import("@/app/(app)/policies/[id]/page"),
  "/stress-test": () => import("@/app/(app)/stress-test/page"),
  "/compare": () => import("@/app/(app)/compare/page"),
  "/review": () => import("@/app/(app)/review/page"),
  "/family": () => import("@/app/(app)/family/page"),
  "/cards": () => import("@/app/(app)/cards/page"),
  "/money": () => import("@/app/(app)/money/page"),
  "/tools": () => import("@/app/(app)/tools/page"),
  "/desk": () => import("@/app/(app)/desk/page"),
  "/emergency": () => import("@/app/(app)/emergency/page"),
  "/assistant": () => import("@/app/(app)/assistant/page"),
  "/shortcuts": () => import("@/app/(app)/shortcuts/page"),
  "/settings": () => import("@/app/(app)/settings/page"),
  "/profile": () => import("@/app/(app)/profile/page"),
};

type Target = { href: string; route: string };
const targets: Target[] = [
  ...PUBLIC_ROUTES.filter((r) => r !== "/status").map((r) => ({ href: r, route: r })),
  ...PAGES.map((p) => ({ href: p.href, route: p.route })),
  ...ONBOARDING_ROUTES.filter((r) => r !== "/welcome").map((r) => ({ href: r, route: "/welcome/[step]" })),
].filter((t, i, a) => a.findIndex((x) => x.href === t.href) === i);

async function element(t: Target): Promise<ReactElement> {
  if (t.route === "/welcome/[step]") {
    const mod = await import("@/app/welcome/[step]/page");
    return (await mod.default({ params: Promise.resolve({ step: t.href.split("/").pop()! }) })) as ReactElement;
  }
  const mod = await PAGE_MODULES[t.route]();
  const props = t.route === "/policies/[id]" ? { params: Promise.resolve({ id: t.href.split("/").pop()! }) } : {};
  return (await (mod.default as (p: unknown) => unknown)(props)) as ReactElement;
}

const BANNED = /\b(sample|demo|preview|draft|placeholder|lorem|not advice|not an insurer|CoverSaath|Saath)\b/i;
const WALLET_JARGON = /\.pkpass|generic (pass|card)/i;
const MINE = /^\/(family|money|tools|desk|emergency|assistant|settings|profile|shortcuts|cards|signin|welcome)?(\/|$)/;
const INTENTS = /\b(explain_term|ask_policy|claim_help|add_document)\b/;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED" } }), { status: 401, headers: { "content-type": "application/json" } })));
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("every route renders", () => {
  it("covers every route in the IA", () => {
    expect(targets.length).toBeGreaterThanOrEqual(20);
    for (const p of PAGES) expect(targets.some((t) => t.route === p.route)).toBe(true);
  });

  it.each(targets.map((t) => [t.href, t] as const))("%s renders without throwing and shows no banned words", async (_href, t) => {
    const tree = await element(t);
    const { container } = render(<ThemeProvider><AgentProvider>{tree}</AgentProvider></ThemeProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    const text = container.textContent ?? "";
    expect(text.trim().length).toBeGreaterThan(20);
    expect(text, `banned word on ${t.href}`).not.toMatch(BANNED);
    expect(text, `wallet jargon on ${t.href}`).not.toMatch(WALLET_JARGON);
    if (MINE.test(t.href)) {
      for (const h of container.querySelectorAll("h1,h2,h3,button,a.k-btn")) {
        const t0 = (h.textContent ?? "").trim();
        expect(t0 === "" || !/^\p{Ll}/u.test(t0), `lowercase start "${t0}" on ${t.href}`).toBe(true);
      }
    }
    expect(text, `raw intent name on ${t.href}`).not.toMatch(INTENTS);
    expect(container.innerHTML, `banned word in markup on ${t.href}`).not.toMatch(/CoverSaath|lorem|placeholder="[^"]*(sample|demo)/i);
  });
});

describe("page contexts", () => {
  it("every route resolves to its own context with three examples", () => {
    for (const t of targets) {
      const ctx = contextFor(t.href);
      expect(ctx.examples, t.href).toHaveLength(3);
      if (t.href !== "/assistant") expect(ctx.route, t.href).not.toBe("/assistant");
    }
    expect(PAGE_CONTEXT["/"].page).toBe("Beta access");
  });
});

describe("integration", () => {
  it("home puts the Ask Knowvia strip right under the greeting, above Cover at a glance", async () => {
    const tree = await element({ href: "/home", route: "/home" });
    const { container } = render(<ThemeProvider><AgentProvider>{tree}</AgentProvider></ThemeProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    const text = container.textContent ?? "";
    expect(text.indexOf("Ask Knowvia anything")).toBeGreaterThan(-1);
    expect(text.indexOf("Ask Knowvia anything")).toBeLessThan(text.search(/cover at a glance/i));
  });

  it("the card opens and answers when a page broadcasts knowvia:ask", async () => {
    const tree = await element({ href: "/assistant", route: "/assistant" });
    const { AgentLayer } = await import("@/components/agent");
    const { container } = render(<ThemeProvider><AgentProvider>{tree}<AgentLayer /></AgentProvider></ThemeProvider>);
    await act(async () => { window.dispatchEvent(new CustomEvent("knowvia:ask", { detail: { text: "Papa ko chest pain hai" } })); await new Promise((r) => setTimeout(r, 50)); });
    expect(container.ownerDocument.body.textContent).toContain("Papa ko chest pain hai");
  });
});
