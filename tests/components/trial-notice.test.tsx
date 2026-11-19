// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const me = vi.hoisted(() => ({ value: { status: "ready", me: { trial: true } } as unknown }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: me.value, retry: () => {} }) }));
vi.mock("@/adapters", () => ({ googleSignIn: true }));
import { TrialNotice } from "@/components/shell/TrialNotice";

afterEach(() => { cleanup(); window.sessionStorage.clear(); });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("TrialNotice", () => {
  it("shows for a trial session with a Google link, and dismisses", async () => {
    me.value = { status: "ready", me: { trial: true } };
    render(<TrialNotice />);
    await flush();
    expect(screen.getByText(/You’re on a trial/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in with Google" }).getAttribute("href")).toBe("/api/app/auth/google");
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/ }));
    expect(screen.queryByText(/You’re on a trial/)).toBeNull();
  });
  it("stays hidden for Google, demo, older sessions and signed-out", async () => {
    for (const v of [{ status: "ready", me: {} }, { status: "ready", me: { trial: false } }, { status: "loading" }, { status: "signed-out" }]) {
      me.value = v;
      const { container } = render(<TrialNotice />);
      await flush();
      expect(container.textContent).toBe("");
      cleanup();
    }
  });
});
