// @vitest-environment jsdom
// Guards the "no control lies" rule: every not-yet-built control renders as a SoonButton and is inert.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SoonButton } from "@/components/ui/SoonButton";
import { MoneyDesk } from "@/components/money/MoneyDesk";
import { CardsPage } from "@/components/wallet/CardsPage";
import { Compare } from "@/components/cover/Compare";
import { PolicyReader } from "@/components/cover/PolicyReader";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function expectSoon(el: HTMLElement) {
  const control = el.closest("button") as HTMLElement;
  expect(control).not.toBeNull();
  expect(control).toHaveAttribute("aria-disabled", "true");
  expect(control).toHaveAttribute("title", "Coming soon");
  return control;
}

describe("SoonButton", () => {
  it("SoonButton renders contract", () => {
    render(<SoonButton>Foo</SoonButton>);
    const control = expectSoon(screen.getByText("Foo", { exact: false }));
    expect(control).toHaveClass("k-btn");
    expect(control.lastElementChild?.textContent).toBe("Soon");
  });

  it("SoonButton click does nothing", () => {
    const submitSpy = vi.fn();
    const href = window.location.href;
    const { container } = render(<form onSubmit={submitSpy}><SoonButton>Foo</SoonButton></form>);
    const before = container.innerHTML;
    const control = expectSoon(screen.getByText("Foo", { exact: false }));
    fireEvent.click(control);
    fireEvent.click(control);
    expect(submitSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(href);
    expect(container.innerHTML).toBe(before);
  });
});

describe("dead controls are Soon", () => {
  it("MoneyDesk Add Outlook and Download 80D pack are Soon", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<MoneyDesk />);
    for (const name of ["Add Outlook", "Download 80D pack"]) {
      const control = expectSoon(screen.getByText(name, { exact: false }));
      fireEvent.click(control);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("CardsPage wallet buttons are Soon", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<CardsPage />);
    for (const name of ["Add to Google Wallet", "Add to Samsung Wallet"]) {
      fireEvent.click(expectSoon(screen.getByText(name, { exact: false })));
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Compare Buy direct is Soon", () => {
    const { container } = render(<Compare />);
    const buttons = screen.getAllByRole("button", { name: /^Buy direct/ });
    expect(buttons.length).toBeGreaterThan(0);
    for (const control of buttons) {
      expectSoon(control);
      expect(control.closest("a[href]")).toBeNull();
      expect(control.parentElement?.className).toMatch(/dcard/);
    }
    expect(container.querySelector('a[href="#direct"]')).toBeNull();
  });

  it("PolicyReader Read guide is Soon", async () => {
    render(<PolicyReader id="northstar-floater" />);
    const guides = await screen.findAllByText("Read guide", { exact: false });
    for (const el of guides) expectSoon(el);
  });
});
