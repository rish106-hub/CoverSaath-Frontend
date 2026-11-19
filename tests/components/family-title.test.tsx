// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ state: { status: "loading" } as unknown }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: h.state, retry: vi.fn() }) }));

import { FamilyTitle } from "@/components/family/FamilyTitle";

afterEach(cleanup);

describe("family page title", () => {
  it("a real account never sees the sample household name", () => {
    h.state = { status: "ready", me: { source: "backend" } };
    render(<FamilyTitle demo="Sample household" />);
    expect(screen.getByRole("heading", { name: "Your household" })).toBeInTheDocument();
    expect(screen.queryByText(/Sample household/)).toBeNull();
  });
  it("the demo keeps its sample name", () => {
    h.state = { status: "ready", me: { source: "mock" } };
    render(<FamilyTitle demo="Sample household" />);
    expect(screen.getByRole("heading", { name: "Sample household" })).toBeInTheDocument();
  });
  it("shows nothing while loading, so the sample never flashes", () => {
    h.state = { status: "loading" };
    const { container } = render(<FamilyTitle demo="Sample household" />);
    expect(container.textContent).toBe("");
  });
});
