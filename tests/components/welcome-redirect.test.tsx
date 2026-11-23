// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replace = vi.fn();
let me: { status: string; me?: { source: string } } = { status: "loading" };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: me }) }));

import { RealUserToUpload } from "@/components/onboarding/RealUserToUpload";

beforeEach(() => replace.mockClear());
afterEach(cleanup);

describe("welcome add step", () => {
  it("sends a real account to the upload flow and shows nothing meanwhile", () => {
    me = { status: "ready", me: { source: "backend" } };
    render(<RealUserToUpload><p>walk-through</p></RealUserToUpload>);
    expect(replace).toHaveBeenCalledWith("/covers/add");
    expect(screen.queryByText("walk-through")).toBeNull();
  });
  it("shows the walk-through to the demo session", () => {
    me = { status: "ready", me: { source: "mock" } };
    render(<RealUserToUpload><p>walk-through</p></RealUserToUpload>);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("walk-through")).toBeTruthy();
  });
  it("shows nothing while the session is unknown", () => {
    me = { status: "loading" };
    render(<RealUserToUpload><p>walk-through</p></RealUserToUpload>);
    expect(screen.queryByText("walk-through")).toBeNull();
  });
});
