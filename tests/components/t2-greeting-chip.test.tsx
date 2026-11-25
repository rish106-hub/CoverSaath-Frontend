// @vitest-environment jsdom
// T2: the heading and the user chip never show a placeholder that is later replaced by the real text.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const h = vi.hoisted(() => ({ me: { status: "loading" } as { status: string; me?: unknown } }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: h.me, retry: vi.fn() }), invalidateMe: vi.fn() }));
vi.mock("@/adapters", () => ({ adapters: { access: { signOut: vi.fn() } } }));
vi.mock("@/adapters/demo", () => ({ isDemoSession: () => false }));

import { HomeGreeting } from "@/components/shell/HomeGreeting";
import { UserChip } from "@/components/shell/UserChip";

afterEach(() => { cleanup(); h.me = { status: "loading" }; });

const READY = { status: "ready", me: { owner: { displayName: "Asha Rao" }, householdName: "Rao" } };

describe("HomeGreeting", () => {
  it("HomeGreeting never renders greeting without name then with name (single text)", () => {
    const { container, rerender } = render(<HomeGreeting />);
    const h1 = () => container.querySelector("h1") as HTMLElement;
    expect(h1().textContent).toBe("Loading");
    expect(h1().textContent).not.toMatch(/^Good (morning|afternoon|evening)\.$/);
    h.me = READY;
    rerender(<HomeGreeting />);
    expect(h1().textContent).toMatch(/^Good (morning|afternoon|evening), Asha\.$/);
  });
});

describe("UserChip", () => {
  it('UserChip renders skeleton pill while loading and never "Your account"', () => {
    const { container, rerender } = render(<UserChip />);
    expect(container.textContent).not.toContain("Your account");
    expect(container.textContent).toBe("");
    expect(container.querySelectorAll("[aria-hidden]").length).toBeGreaterThanOrEqual(2);
    h.me = READY;
    rerender(<UserChip />);
    expect(container.textContent).toContain("Asha Rao");
    h.me = { status: "down" };
    rerender(<UserChip />);
    expect(container.textContent).toContain("Profile");
    expect(container.textContent).not.toContain("Your account");
  });
});
