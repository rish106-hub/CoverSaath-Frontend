// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/signin" }));
vi.hoisted(() => { process.env.NEXT_PUBLIC_ADAPTERS = "mock"; });

import { SignIn } from "@/components/public/SignIn";
import { AUTH_HEADS } from "@/data/mock";

// Pretend the viewport is wide; `reduce` answers the reduced-motion query.
function stubMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("min-width") ? true : q.includes("reduce") ? reduce : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const current = () => screen.getAllByRole("button", { name: AUTH_HEADS[0]![0] })[0]!;

describe("sign-in showcase pause control (#109 row 23)", () => {
  it("pauses and resumes the lanes and the headline rotation", () => {
    stubMedia(false);
    vi.useFakeTimers();
    const { container } = render(<SignIn />);
    const lanes = container.querySelector('[class*="lanes"]')!;
    const toggle = screen.getByRole("button", { name: "Pause animation" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(lanes.className).not.toContain("lanesPaused");
    act(() => { vi.advanceTimersByTime(3300); });
    expect(current()).not.toHaveAttribute("aria-current");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Play animation" })).toHaveAttribute("aria-pressed", "true");
    expect(lanes.className).toContain("lanesPaused");
    const before = AUTH_HEADS.findIndex((_, k) => screen.getAllByRole("button", { name: AUTH_HEADS[k]![0] })[0]!.getAttribute("aria-current") === "true");
    act(() => { vi.advanceTimersByTime(10000); });
    const after = AUTH_HEADS.findIndex((_, k) => screen.getAllByRole("button", { name: AUTH_HEADS[k]![0] })[0]!.getAttribute("aria-current") === "true");
    expect(after).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Play animation" }));
    expect(lanes.className).not.toContain("lanesPaused");
  });

  it("shows no pause control under reduced motion, where nothing moves", () => {
    stubMedia(true);
    render(<SignIn />);
    expect(screen.queryByRole("button", { name: /animation/ })).toBeNull();
  });
});

describe("sign-in headline dots (#109 row 24)", () => {
  it("marks the current dot, switches on click, and keeps colours out of inline styles", () => {
    stubMedia(true);
    render(<SignIn />);
    AUTH_HEADS.forEach(([label], k) => {
      const dot = screen.getByRole("button", { name: label });
      expect(dot.getAttribute("style")).toBeNull();
      expect(dot.firstElementChild?.getAttribute("style")).toBeNull();
      fireEvent.click(dot);
      expect(dot).toHaveAttribute("aria-current", "true");
      AUTH_HEADS.forEach(([other], j) => { if (j !== k) expect(screen.getByRole("button", { name: other })).not.toHaveAttribute("aria-current"); });
    });
  });
});
