// @vitest-environment jsdom
// useFit (spec R5b.7): how many rows a box of a given height holds, between a minimum and a maximum, measured with a ResizeObserver.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useFit } from "@/components/cover-real/use-fit";

type Callback = (entries: { target: Element }[]) => void;
const watchers: { callback: Callback; element: Element }[] = [];

class FakeResizeObserver {
  private readonly callback: Callback;
  constructor(callback: Callback) { this.callback = callback; }
  observe(element: Element) { watchers.push({ callback: this.callback, element }); }
  disconnect() { /* nothing to release in the fake */ }
}

afterEach(() => {
  cleanup();
  watchers.length = 0;
  vi.unstubAllGlobals();
});

function Probe({ unit = 100, min = 1, max = 4 }: { unit?: number; min?: number; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = useFit(ref, unit, min, max);
  return <div ref={ref} data-testid="box">{rows}</div>;
}

/** Tells every observer the box is now `height` px tall. */
function resizeTo(height: number) {
  const box = screen.getByTestId("box");
  vi.spyOn(box, "getBoundingClientRect").mockReturnValue({ height } as DOMRect);
  act(() => { watchers.forEach((w) => w.callback([{ target: w.element }])); });
}

describe("useFit", () => {
  it("returns the maximum before any measure and when the box has no height (jsdom)", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<Probe />);
    expect(screen.getByTestId("box")).toHaveTextContent("4");
    resizeTo(0);
    expect(screen.getByTestId("box")).toHaveTextContent("4");
  });

  it("returns the maximum when ResizeObserver does not exist", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<Probe />);
    expect(screen.getByTestId("box")).toHaveTextContent("4");
  });

  it("returns floor(height / unit) between the minimum and the maximum", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<Probe min={2} max={4} />);
    resizeTo(250);
    expect(screen.getByTestId("box")).toHaveTextContent("2");
    resizeTo(399);
    expect(screen.getByTestId("box")).toHaveTextContent("3");
    resizeTo(1000);
    expect(screen.getByTestId("box")).toHaveTextContent("4");
    resizeTo(50);
    expect(screen.getByTestId("box")).toHaveTextContent("2");
  });
});
