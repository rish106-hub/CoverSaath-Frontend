// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { adapters } from "@/adapters";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/signin" }));

import { AccessCard } from "@/components/access/AccessCard";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("trial sign-in at the session cap", () => {
  it("says busy and to retry, not that Knowvia cannot be reached", async () => {
    vi.spyOn(adapters.access, "submit").mockResolvedValue({ ok: false, code: "RATE_LIMITED" });
    render(<AccessCard />);
    const [nameBox, emailBox] = screen.getAllByRole("textbox");
    fireEvent.change(nameBox!, { target: { value: "Meera Rao" } });
    fireEvent.change(emailBox!, { target: { value: "meera.rao@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Too many sign-ins right now/);
  });
});
