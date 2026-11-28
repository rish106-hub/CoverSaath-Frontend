// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/signin" }));
vi.hoisted(() => { process.env.NEXT_PUBLIC_ADAPTERS = "mock"; });

import { SignIn } from "@/components/public/SignIn";

afterEach(cleanup);

describe("sign-in opening page", () => {
  it("the opening page has no showcase, pause control or rotating headline", () => {
    const { container } = render(<SignIn />);
    expect(screen.queryByRole("button", { name: /animation/i })).toBeNull();
    expect(container.querySelector('[class*="lanes"], [class*="headline"], [class*="heads"]')).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
