// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/" }));

import Privacy from "@/app/privacy/page";
import Terms from "@/app/terms/page";
import Contact from "@/app/contact/page";

afterEach(cleanup);

describe("legal pages", () => {
  it.each([["Privacy", Privacy], ["Terms", Terms], ["Contact", Contact]] as const)("%s page renders a heading", (title, Page) => {
    const { getByRole } = render(<Page />);
    expect(getByRole("heading", { name: title })).toBeTruthy();
  });
  it.each(["src/components/public/Landing.tsx", "src/components/public/SignIn.tsx", "src/components/access/AccessCard.tsx"])("%s has no dead # links", (f) => {
    expect(readFileSync(f, "utf8")).not.toMatch(/href="#"/);
  });
});
