// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Holding overview (home and policies): loading, empty and error with Retry, for the demo list and the session gate in front of the real views.
const policyList = vi.fn();
const household = vi.fn();
const meCall = vi.fn();
vi.mock("@/adapters", () => ({
  adapters: { policy: { list: () => policyList() }, household: { household: () => household(), me: () => meCall() } },
}));

import { PolicyList } from "@/components/cover/PolicyList";
import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { invalidateMe } from "@/components/shell/useMe";

beforeEach(() => invalidateMe());
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("holding overview states", () => {
  it("loading: policies list shows the skeleton", () => {
    policyList.mockReturnValue(new Promise(() => undefined));
    household.mockReturnValue(new Promise(() => undefined));
    render(<PolicyList />);
    expect(screen.getByRole("status").hasAttribute("data-skeleton")).toBe(true);
  });

  it("empty: no policies shows the upload prompt", async () => {
    policyList.mockResolvedValue([]);
    household.mockResolvedValue({ members: [] });
    render(<PolicyList />);
    expect(await screen.findByTestId("empty-state")).toBeTruthy();
  });

  it("error: a failed load is not shown as empty, hides raw text, and Retry reloads", async () => {
    policyList.mockRejectedValueOnce(new Error("TypeError: fetch failed 503"));
    household.mockResolvedValue({ members: [] });
    render(<PolicyList />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/TypeError|503/);
    expect(screen.queryByTestId("empty-state")).toBeNull();
    policyList.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("empty-state")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("loading: the session gate shows a skeleton while the session is unknown", () => {
    meCall.mockReturnValue(new Promise(() => undefined));
    render(<DemoGate empty={<EmptyState title="Nothing here yet" body="x" />}><p>demo</p></DemoGate>);
    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.queryByText("demo")).toBeNull();
  });
});
