// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AppError from "@/app/(app)/error";
import RootError from "@/app/error";
import GlobalError from "@/app/global-error";
import Loading from "@/app/(app)/loading";
import NotFound from "@/app/not-found";

afterEach(cleanup);
const boom = Object.assign(new Error("SECRET stack detail 0xdeadbeef"), { digest: "d1" });

describe("error containment", () => {
  it.each([
    ["app error", () => <AppError error={boom} reset={vi.fn()} />],
    ["root error", () => <RootError error={boom} reset={vi.fn()} />],
  ])("%s shows calm copy, no raw error text, and a working Try again", (_n, ui) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(ui());
    expect(container.textContent).not.toMatch(/SECRET|deadbeef|stack/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("Try again calls reset once per click", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    render(<AppError error={boom} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("global error renders its own document with Try again and no raw text", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const { container } = render(<GlobalError error={boom} reset={reset} />, { container: document.documentElement });
    expect(container.textContent).not.toMatch(/SECRET|deadbeef/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
  });

  it("loading and not-found render", () => {
    render(<><Loading /><NotFound /></>);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/could not find/);
  });
});
