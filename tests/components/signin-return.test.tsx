// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/signin" }));
vi.hoisted(() => { process.env.NEXT_PUBLIC_ADAPTERS = "mock"; });

import { SignIn } from "@/components/public/SignIn";

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

async function signedIn(url: string) {
  window.history.replaceState(null, "", url);
  render(<SignIn />);
  fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
  return screen.findByRole("status");
}

describe("sign-in return path", () => {
  it("lands on the page the visitor was going to", async () => {
    await signedIn("/signin?next=%2Fcovers%2Fadd&email=a%40b.co");
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/covers/add");
  });
  it.each(["//evil.example", "https://evil.example", "/%2F%2Fevil.example", "/admin"])("ignores an unsafe return path %s", async (bad) => {
    await signedIn(`/signin?next=${encodeURIComponent(bad)}`);
    expect(screen.getByRole("link", { name: "Add my policy" })).toHaveAttribute("href", "/welcome/add");
  });
});
