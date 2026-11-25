// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replace = vi.fn();
let me: { status: string; me?: { source: string } } = { status: "loading" };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }), notFound: () => { throw new Error("notFound"); } }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: me, retry: vi.fn() }) }));
vi.mock("@/components/onboarding/Flow", () => ({ OnboardingFlow: ({ slug }: { slug: string }) => <p>flow-{slug}</p> }));

import Step from "@/app/welcome/[step]/page";

const STEPS = ["add", "reading", "people", "ready"];

beforeEach(() => replace.mockClear());
afterEach(cleanup);

describe.each(STEPS)("welcome step %s", (slug) => {
  it("sends a real account to the upload flow and shows nothing", async () => {
    me = { status: "ready", me: { source: "backend" } };
    render(await Step({ params: Promise.resolve({ step: slug }) }));
    expect(replace).toHaveBeenCalledWith("/covers/add");
    expect(screen.queryByText(`flow-${slug}`)).toBeNull();
  });
  it("renders for the demo session", async () => {
    me = { status: "ready", me: { source: "mock" } };
    render(await Step({ params: Promise.resolve({ step: slug }) }));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(`flow-${slug}`)).toBeTruthy();
  });
  it("shows nothing while the session is unknown", async () => {
    me = { status: "loading" };
    const { container } = render(await Step({ params: Promise.resolve({ step: slug }) }));
    expect(replace).not.toHaveBeenCalled();
    // Only the skeleton's screen-reader text may show; no step content.
    expect(container.textContent).toBe("Loading");
  });
});
