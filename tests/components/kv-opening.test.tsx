// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/signin" }));
// Under test the adapters are the mock set, so SignIn shows the mock start form; the backend access form is rendered directly.

import SignInRoute from "@/app/signin/page";
import HomeRoute from "@/app/page";
import { SignIn } from "@/components/public/SignIn";
import { AccessCard } from "@/components/access/AccessCard";

afterEach(cleanup);

const PUNCH_LINE = "Health cover, finally clear.";

describe("opening page", () => {
  it("the punch line is the only heading on the start step and has at most five words", () => {
    render(<SignIn />);
    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(PUNCH_LINE);
    expect(PUNCH_LINE.split(/\s+/).length).toBeLessThanOrEqual(5);
  });

  it("the start step has no journey list, whys row, showcase or theme toggle", () => {
    const { container } = render(<SignIn />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(container.querySelector('[class*="whys"], [class*="right"], [class*="lanes"], [class*="journey"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /theme|dark|light|animation/i })).toBeNull();
    expect(container.textContent).not.toMatch(/Private beta|Welcome to Knowvia|What you’ll see/);
  });

  it("terms and privacy links sit in the footer row", () => {
    render(<SignIn />);
    const terms = screen.getByRole("link", { name: "Terms" });
    const privacy = screen.getByRole("link", { name: "Privacy" });
    expect(terms).toHaveAttribute("href", "/terms");
    expect(privacy).toHaveAttribute("href", "/privacy");
    expect(terms.parentElement).toBe(privacy.parentElement);
    expect(terms.parentElement?.textContent).toBe("TermsPrivacy");
  });

  it("the access form has name, email and a Sign in button, with no title or trial note", () => {
    const { container } = render(<AccessCard />);
    const form = screen.getByRole("form", { name: "Sign in" });
    expect(form).toContainElement(screen.getByLabelText("Your name"));
    expect(form).toContainElement(screen.getByLabelText("Email"));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Get access|Trial/);
  });

  it("the photograph is decorative and has no caption", () => {
    const { container } = render(<SignIn />);
    const photo = container.querySelector('img[src*="family.jpg"]');
    expect(photo).not.toBeNull();
    expect(photo).toHaveAttribute("alt", "");
    const frame = photo!.parentElement!;
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(frame.textContent).toBe("");
    expect(frame.querySelectorAll("figcaption, p, span")).toHaveLength(0);
  });

  it("the home route renders the same opening page", () => {
    expect(HomeRoute()).toEqual(SignInRoute());
    render(HomeRoute());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(PUNCH_LINE);
  });
});
