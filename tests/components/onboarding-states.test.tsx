// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Loading, empty and error (with retry) states of the welcome walk-through, for a real account's reading step and the gate before it.
let me: { status: string; me?: { source: string; owner: { displayName: string } } } = { status: "ready", me: { source: "backend", owner: { displayName: "Asha" } } };
const findings = vi.fn();
const policyList = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: me, retry: vi.fn() }) }));
vi.mock("@/adapters", () => ({
  adapters: {
    onboarding: { get: async () => null, save: async () => undefined },
    reading: { findings: (...a: unknown[]) => findings(...a) },
    policy: { list: () => policyList() },
  },
}));

import { OnboardingFlow } from "@/components/onboarding/Flow";
import { RealUserToUpload } from "@/components/onboarding/RealUserToUpload";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("welcome walk-through states", () => {
  it("shows a loading state, not a blank page, while the session is unknown", () => {
    me = { status: "loading" };
    render(<RealUserToUpload><p>steps</p></RealUserToUpload>);
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    expect(screen.queryByText("steps")).toBeNull();
  });

  it("reading step: loading while the request is in flight", () => {
    me = { status: "ready", me: { source: "backend", owner: { displayName: "Asha" } } };
    policyList.mockReturnValue(new Promise(() => undefined));
    render(<OnboardingFlow slug="reading" />);
    expect(screen.getByRole("heading", { name: "Reading your policy" })).toBeTruthy();
  });

  it("reading step: empty state when nothing has been read", async () => {
    me = { status: "ready", me: { source: "backend", owner: { displayName: "Asha" } } };
    policyList.mockResolvedValue([]);
    render(<OnboardingFlow slug="reading" />);
    expect(await screen.findByTestId("reading-empty")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No key terms read yet" })).toBeTruthy();
  });

  it("reading step: error state in plain English with Retry, no raw error text, and retry loads the terms", async () => {
    me = { status: "ready", me: { source: "backend", owner: { displayName: "Asha" } } };
    policyList.mockResolvedValue([{ id: "p1" }]);
    findings.mockRejectedValueOnce(new Error("HTTP 502 stack trace at /srv/bff"));
    render(<OnboardingFlow slug="reading" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/502|stack trace|\/srv/);
    expect(screen.queryByTestId("reading-empty")).toBeNull();
    findings.mockResolvedValueOnce([{ label: "Sum insured", answer: "Rs 5,00,000", pageRef: "p. 2" }]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Sum insured")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
